import * as probot from "probot-ts";
import * as Context from "probot-ts/lib/context";
import * as EnhancedGitHubClient from "probot-ts/lib/github";
import * as logger from "probot-ts/lib/logger";
import {MergeTask} from "../functions/src/plugins/merge";
import {appConfig} from "../functions/src/default";
import {MockFirestore} from './mocks/firestore';
import {mockGithub} from "./mocks/github";

describe('triage', () => {
  let robot: probot;
  let github: probot.github;
  let mergeTask: MergeTask;
  let store: FirebaseFirestore.Firestore;

  beforeEach(() => {
    mockGithub('repos');
    mockGithub('get-installations');
    mockGithub('get-installation-repositories');
    mockGithub('repo-pull-requests');
    mockGithub('repo-pull-request');

    // create the mock Firebase Firestore
    store = new MockFirestore();

    // Mock out the GitHub API
    github = new EnhancedGitHubClient({
      logger: logger
    });

    // Create a new Robot to run our plugin
    robot = probot.createRobot();

    // Mock out GitHub App authentication and return our mock client
    robot.auth = () => Promise.resolve(github);

    // create plugin
    mergeTask = new MergeTask(robot, store);
  });

  describe('getConfig', () => {
    it('should return the default merge config', async () => {
      const event = require('./fixtures/issue.opened.json');
      const context = new Context(event, github);
      const config = await mergeTask.getConfig(context);
      expect(config).toEqual(appConfig.merge);
    });
  });

  describe('init', () => {
    it('should work with a manual init', async () => {
      await mergeTask.manualInit();
      const storeData = await mergeTask.repositories.get();
      expect(storeData.docs.length).toBeGreaterThan(0);
      // our data set in mocks/scenarii/api.github.com/get-installation-repositories.json returns a repository whose name is "test"
      expect(storeData.docs[0]['name']).toEqual('test');
    });

    it('should work on repository added', async () => {
      const event = require('./fixtures/installation_repositories.added.json');
      const context = new Context(event, github);
      await mergeTask.installInit(context);
      const storeData = await mergeTask.repositories.get();
      expect(storeData.docs.length).toBeGreaterThan(0);
      // our data set in mocks/scenarii/api.github.com/get-installation-repositories.json returns a repository whose name is "test"
      expect(storeData.docs[0]['name']).toEqual('test');
    });

    it('should work on app installation', async () => {
      const event = require('./fixtures/installation.created.json');
      const context = new Context(event, github);
      await mergeTask.init(github, event.payload.repositories);
      const storeData = await mergeTask.pullRequests.get();
      expect(storeData.docs.length).toBeGreaterThan(0);
      // our data set in mocks/scenarii/api.github.com/repo-pull-request.json returns a PR whose number value is 1
      expect(storeData.docs[0]['number']).toEqual(1);
    });
  });
});