## Dependency Assessment Plugin

Run an analysis of dependencies within a code base, to see which parts of a code base are depended on by another. This is useful for a number of code maintenance challenges. A good example is trying to lift out one part of a code base to another repo or library.

### Basic Usage

```js
// webpack.config.js
const DependencyAssessmentPlugin = require('dependency-assessment-plugin')

module.exports = {
  entry: "./src/index",
  plugins: [
    new DependencyAssessmentPlugin({
      // exclude detection of files based on a RegExp
      exclude: /a\.js|node_modules/,
      // include specific files based on a RegExp
      include: /src\/common/,
      // the code you are trying to analyse for local dependencies
      subject: /src\/extract_me/,
      // Include individual entries for every named import: default false
      includeNamedImports: true,
      // add errors to webpack instead of warnings
      failOnError: true,
      // set the current working directory for displaying module paths
      cwd: process.cwd(),
    })
  ]
}
```

### Example

Imagine an app with several different folders:
- src/wheels
- src/axle
- src/engine

If I am trying to extract `wheels` I want to understand all the current dependencies it has on the rest of this code base. I would want to run with config like:
```
{
  exclude: /node_modules/,
  include: /axle|engine/,
  subject: /wheels/
}
```

I might see output like:

```
src/axle/index.js -> attachToAxle
 - src/wheels/index.js
src/axle/index.js -> detachFromAxle
 - src/wheels/index.js
```

Right now the analysis is only performing a single layer of dependency analysis, it is not then scanning the tree to find all upstream/indirect dependencies.

### Maintenance

Feel free to fork, create an issue or raise a PR if you would like to request a change.
