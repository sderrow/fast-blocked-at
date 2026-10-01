declare module "node-gyp-build" {
  function load(dir?: string): unknown;
  namespace load {
    function resolve(dir?: string): string;
  }
  export = load;
}
