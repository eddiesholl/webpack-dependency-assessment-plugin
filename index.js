let path = require('path')
let extend = require('util')._extend
let chalk = require("chalk")
let BASE_ERROR = 'Circular dependency detected:\r\n'
let PluginTitle = 'DependencyAssessmentPlugin'

class DependencyAssessmentPlugin {
  constructor(options) {
    this.options = extend({
      exclude: new RegExp('$^'),
      include: new RegExp('.*'),
      subject: new RegExp('$^'),
      failOnError: false,
      allowAsyncCycles: false,
      onDetected: false,
      cwd: process.cwd()
    }, options)
  }

  apply(compiler) {
    let plugin = this
    let cwd = this.options.cwd

    compiler.hooks.compilation.tap(PluginTitle, (compilation) => {
      compilation.hooks.optimizeModules.tap(PluginTitle, (modules) => {
        if (plugin.options.onStart) {
          plugin.options.onStart({ compilation });
        }

        compilation.getLogger(PluginTitle).info('hello compilation')

        const graph = this.createGraphForModules(modules, plugin)
        // this.outputGraph(graph, compilation)
        const output = this.formatGraph(graph)
        compilation.warnings.push(output)
        // console.dir(modules[100].resource)
      })
    })
  }

  createGraphForModules(modules, plugin) {
    let cwd = this.options.cwd
    const direct = {}
    const all = {}

    for (let module of modules) {
      const shouldSkipSubject = (
        module.resource == null ||
        !plugin.options.subject.test(module.resource)
      )
      // skip the module if it matches the exclude pattern
      if (shouldSkipSubject) {
        continue
      }

      // Iterate over the current modules dependencies
      for (let dependency of module.dependencies) {
        if (
          dependency.constructor &&
          dependency.constructor.name === 'CommonJsSelfReferenceDependency'
        ) {
          continue
        }

        let depModule = null
        depModule = dependency.module

        if (!depModule) { continue }
        // ignore dependencies that don't have an associated resource
        if (!depModule.resource) { continue }

        const shouldSkipTarget = (
          module.resource == null ||
          plugin.options.exclude.test(depModule.resource) ||
          !plugin.options.include.test(depModule.resource) ||
          plugin.options.subject.test(depModule.resource)
        )
        // skip the module if it matches the exclude pattern
        if (shouldSkipTarget) {
          continue
        }

        let subjectPath = path.relative(cwd, module.resource)
        let subDepPath = path.relative(cwd, depModule.resource)
        let importName = dependency.name ? `${subDepPath} -> ${dependency.name}` : subDepPath
        let directDepItem = direct[importName]
        if (directDepItem) {
          if (!directDepItem.includes(subjectPath)) {
            directDepItem.push(subjectPath)
          }
        } else {
          direct[importName] = [subjectPath]
        }
      }
    }

    return {
      direct,
      all
    }
  }

  formatGraph(graph) {
    const directLines = Object.keys(graph.direct)
      .sort()
      .map(k => {
        const subjects = graph.direct[k].sort().map(d => ` - ${chalk.white(d)}`).join('\n')
        return `${chalk.green.bold(k)}\n${subjects}`
      })
      .join('\n')

    return `Direct dependencies:\n${directLines}`
  }

  outputGraph(graph, compilation) {
    const out = compilation.warnings
    Object.keys(graph.direct)
      .sort()
      .forEach(dep => {
        out.push(dep)
        graph.direct[dep].sort().map(d => out.push(` - ${d}`))
      })
  }

  isCyclic(initialModule, currentModule, seenModules, compilation) {
    let cwd = this.options.cwd

    // Add the current module to the seen modules cache
    seenModules[currentModule.debugId] = true

    // If the modules aren't associated to resources
    // it's not possible to display how they are cyclical
    if (!currentModule.resource || !initialModule.resource) {
      return false
    }

    // Iterate over the current modules dependencies
    for (let dependency of currentModule.dependencies) {
      if (
        dependency.constructor &&
        dependency.constructor.name === 'CommonJsSelfReferenceDependency'
      ) {
        continue
      }

      let depModule = null
      if (compilation.moduleGraph) {
        // handle getting a module for webpack 5
        depModule = compilation.moduleGraph.getModule(dependency)
      } else {
        // handle getting a module for webpack 4
        depModule = dependency.module
      }

      if (!depModule) { continue }
      // ignore dependencies that don't have an associated resource
      if (!depModule.resource) { continue }
      // ignore dependencies that are resolved asynchronously
      if (this.options.allowAsyncCycles && dependency.weak) { continue }
      // the dependency was resolved to the current module due to how webpack internals
      // setup dependencies like CommonJsSelfReferenceDependency and ModuleDecoratorDependency
      if (currentModule === depModule) {
        continue
      }

      if (depModule.debugId in seenModules) {
        if (depModule.debugId === initialModule.debugId) {
          // Initial module has a circular dependency
          return [
            path.relative(cwd, currentModule.resource),
            path.relative(cwd, depModule.resource)
          ]
        }
        // Found a cycle, but not for this module
        continue
      }

      let maybeCyclicalPathsList = this.isCyclic(initialModule, depModule, seenModules, compilation)
      if (maybeCyclicalPathsList) {
        maybeCyclicalPathsList.unshift(path.relative(cwd, currentModule.resource))
        return maybeCyclicalPathsList
      }
    }

    return false
  }
}

module.exports = DependencyAssessmentPlugin
