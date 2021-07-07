let path = require('path')
let extend = require('util')._extend
let chalk = require("chalk")
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
        const output = this.formatGraph(graph)
        compilation.warnings.push(output)
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

}

module.exports = DependencyAssessmentPlugin
