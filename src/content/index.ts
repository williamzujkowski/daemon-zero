/**
 * Content entry point. It is the production composition, so the app, tests, sim and
 * validation all load production content. A preview build swaps this module for
 * ./preview at bundle time; nothing in this folder reads the environment.
 */
export * from './production';
