/* eslint-disable jest/expect-expect */
/*
Copyright 2022 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const helpers = require('yeoman-test')
const assert = require('yeoman-assert')
const fs = require('fs')
const yaml = require('js-yaml')
const path = require('path')
const { EOL } = require('os')
const cloneDeep = require('lodash.clonedeep')

const theGeneratorPath = require.resolve('../index')
const Generator = require('yeoman-generator')

const { constants } = require('@adobe/generator-app-common-lib')

describe('prototype', () => {
  test('exports a yeoman generator', () => {
    expect(require(theGeneratorPath).prototype).toBeInstanceOf(Generator)
  })
})

function assertGeneratedFiles (actionName) {
  assert.file(`${constants.actionsDirname}/${actionName}/index.js`)

  assert.file(`test/${actionName}.test.js`)
  assert.file(`e2e/${actionName}.e2e.test.js`)

  assert.file(`${constants.actionsDirname}/utils.js`)
  assert.file('test/utils.test.js')

  assert.file('ext.config.yaml')
  assert.file('.env')
}

// pkgName is optional
function assertManifestContent (actionName, pkgName) {
  const json = yaml.load(fs.readFileSync('ext.config.yaml').toString())
  expect(json.runtimeManifest.packages).toBeDefined()

  // default packageName is path.basename(path.dirname('ext.config.yaml'))
  pkgName = pkgName || path.basename(process.cwd())

  expect(json.runtimeManifest.packages[pkgName].actions[actionName]).toEqual({
    function: `${constants.actionsDirname}/${actionName}/index.js`,
    web: 'yes',
    runtime: constants.defaultRuntimeKind,
    inputs: {
      LOG_LEVEL: 'debug',
      apiKey: '$SERVICE_API_KEY',
      tenant: '$CAMPAIGN_STANDARD_TENANT'
    },
    annotations: {
      final: true,
      'require-adobe-auth': true
    }
  })
}

function assertEnvContent (prevContent) {
  assert.fileContent('.env', `## please provide your Adobe I/O Campaign Standard tenant${EOL}#CAMPAIGN_STANDARD_TENANT=`)
  assert.fileContent('.env', prevContent)
}

function assertActionCodeContent (actionName) {
  const theFile = `${constants.actionsDirname}/${actionName}/index.js`
  // a few checks to make sure the action calls the sdk
  assert.fileContent(
    theFile,
    'const { Core, CampaignStandard } = require(\'@adobe/aio-sdk\')'
  )
  assert.fileContent(
    theFile,
    'const requiredParams = [\'apiKey\', \'tenant\']'
  )
  assert.fileContent(
    theFile,
    'const requiredHeaders = [\'Authorization\']'
  )
  assert.fileContent(
    theFile,
    'const campaignClient = await CampaignStandard.init(params.tenant, params.apiKey, token)'
  )
  assert.fileContent(
    theFile,
    'const profiles = await campaignClient.getAllProfiles()'
  )
}

describe('run', () => {
  test('--skip-prompt', async () => {
    const options = cloneDeep(global.basicGeneratorOptions)
    options['skip-prompt'] = true
    const prevDotEnvContent = `PREVIOUSCONTENT${EOL}`
    await helpers.run(theGeneratorPath)
      .withOptions(options)
      .inTmpDir(dir => {
        fs.writeFileSync(path.join(dir, '.env'), prevDotEnvContent)
      })

    // default
    const actionName = 'campaign-standard'

    assertGeneratedFiles(actionName)
    assertActionCodeContent(actionName)
    assertManifestContent(actionName)
    assertEnvContent(prevDotEnvContent)
    assertDependencies(fs, { '@adobe/aio-sdk': expect.any(String) })
    assertNodeEngines(fs, constants.nodeEngines)
  })

  test('--skip-prompt, and action with default name already exists', async () => {
    const options = cloneDeep(global.basicGeneratorOptions)
    options['skip-prompt'] = true
    const prevDotEnvContent = `PREVIOUSCONTENT${EOL}`
    await helpers.run(theGeneratorPath)
      .withOptions(options)
      .inTmpDir(dir => {
        fs.writeFileSync('ext.config.yaml', yaml.dump({
          runtimeManifest: {
            packages: {
              somepackage: {
                actions: {
                  'campaign-standard': { function: 'fake.js' }
                }
              }
            }
          }
        }))
        fs.writeFileSync(path.join(dir, '.env'), prevDotEnvContent)
      })

    // default
    const actionName = 'campaign-standard-1'
    assertGeneratedFiles(actionName)
    assertActionCodeContent(actionName)
    assertManifestContent(actionName, 'somepackage')
    assertEnvContent(prevDotEnvContent)
    assertDependencies(fs, { '@adobe/aio-sdk': expect.any(String) })
    assertNodeEngines(fs, constants.nodeEngines)
  })

  test('user input actionName=fakeAction', async () => {
    const options = cloneDeep(global.basicGeneratorOptions)
    options['skip-prompt'] = false
    const prevDotEnvContent = `PREVIOUSCONTENT${EOL}`
    await helpers.run(theGeneratorPath)
      .withOptions(options)
      .withPrompts({ actionName: 'fakeAction' })
      .inTmpDir(dir => {
        fs.writeFileSync(path.join(dir, '.env'), prevDotEnvContent)
      })

    const actionName = 'fakeAction'

    assertGeneratedFiles(actionName)
    assertActionCodeContent(actionName)
    assertManifestContent(actionName)
    assertEnvContent(prevDotEnvContent)
    assertDependencies(fs, { '@adobe/aio-sdk': expect.any(String) })
    assertNodeEngines(fs, constants.nodeEngines)
  })
})
