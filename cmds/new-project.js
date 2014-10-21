/* new_project commander component
 * To use add require('../cmds/new-project.js')(program) to your commander.js based node executable before program.parse
 */
'use strict';

var inquirer = require('inquirer');
var _ = require('lodash');
var merge = require('merge');
var Renderer = require('../lib/ui/renderer');
var Project = require('../lib/project');
var SalesforceClient = require('../lib/sfdc-client');
var util = require('../lib/util').instance;

module.exports = function(program) {

	var _getSobjectList = function(describeResult) {
		var sobjects = [];
		_.each(describeResult.sobjects, function(so) {
			sobjects.push(so.name);
		});
		return sobjects;
	};

	program
		.command('new-project')
		.alias('new_project')
		.version('0.0.1')
		.description('Creates a new Salesforce1 project')
		.action(function(){
			if (program.isUICommand()) {
				var renderer = new Renderer('new-project');
				renderer.render()
					.then(function(tmpFileLocation){
						return program.respond(tmpFileLocation);
					});
			} else if (program.isHeadless()) {
				
				var jsonPayload;

				program.readStdin()
					.then(function(stdInResult) {
						jsonPayload = stdInResult;
						var sfdcClient = new SalesforceClient(jsonPayload);
						return sfdcClient.login();
					})
					.then(function(loginResult) {
						var newProject = new Project(jsonPayload);
						return newProject.retrieveAndWriteToDisk();
					})
					.then(function() {
						console.log('ok all set!');
					})
					['catch'](function(error) {
						console.log('error!');
						console.log(error);
					})
					['finally'](function() {
						// console.log('done!');
					});

			} else if (program.isInteractive()) {	
				var userInput;

				inquirer.prompt([
				  {
			      type: 'input',
			      name: 'name',
			      message: 'What would you like to name your project?'
			    },
				  {
				    type: 'list',
				    name: 'orgType',
				    message: 'What kind of org who you like to connect to?',
				    choices: [
				      'Production',
				      'Sandbox',
				      'Prerelease',
				      'Custom'
				    ]
				  },
				  {
			      type: 'input',
			      name: 'username',
			      message: 'Please enter your salesforce.com username'
			    },
			    {
			      type: 'password',
			      name: 'password',
			      message: 'Please enter your salesforce.com password'
			    },
			    {
			      type: 'input',
			      name: 'token',
			      message: 'Please enter your security token (optional)'
			    }
				], function( answers ) {
					// the first few prompts ensure we have the proper context to connect to salesforce,
					// do a describe and offer a list of types to download 
					// console.log( JSON.stringify(answers, null, '  ') );
					userInput = answers;

					var opts = {
						username : answers.username,
						password : answers.password,
						orgType : answers.orgType,
						securityToken : answers.token
					};

					var sfdcClient = new SalesforceClient(opts);

					sfdcClient.login()
						.then(function(loginResult) {
							return sfdcClient.describeGlobal();
						})
						.then(function(describeResult) {
							
							// assemble a list of sobject types to present to user
							var sobjects = _getSobjectList(describeResult);
							var apexVfMetadata = [
								'ApexClass',
								'ApexComponent',
								'ApexPage',
								'ApexTrigger',
								'StaticResource'
							];
							var unpackagedChoices = [
								new inquirer.Separator('Apex/Visualforce')
							];
							_.each(apexVfMetadata, function(m) {
								unpackagedChoices.push({
									name: m,
									checked: true
								});
							});
							unpackagedChoices.push(new inquirer.Separator('Other metadata types:'));
							_.each(sobjects, function(so) {
								if (apexVfMetadata.indexOf(so) === -1) {
									unpackagedChoices.push({
										name: so
									});
								}
							});

							// present list for selection (apex/vf types selected by default)
							inquirer.prompt([
								{
								  type: 'list',
								  name: 'projectType',
								  message: 'Would you like to download a package or select from unpackaged metadata?',
								  choices: [
								    'Unpackaged',
								    'Package'
								  ]
								} 
						  ], function(answers) {
						  	userInput = merge.recursive(answers, userInput);

						  	if (answers.projectType === 'Package') {
						  		// present list of packages
						  		inquirer.prompt([
					  			  {
					  		      type: 'checkbox',
					  		      message: 'Please select the packages you wish to download',
					  		      name: 'packages',
					  		      choices: choices,
					  		      validate: function( answer ) {
					  		        if ( answer.length < 1 ) {
					  		          return 'You must choose at least one package.';
					  		        }
					  		        return true;
					  		      }
					  		    }
					  		  ], function(answers) {
						  			userInput = merge.recursive(answers, userInput);
						  			sfdcClient.retrievePackaged(answers.packages);	
					  		  });	
						  	} else {
					  			// present list for selection (apex/vf types selected by default)
					  			inquirer.prompt([
					  			  {
					  		      type: 'checkbox',
					  		      message: 'Please select the metadata types you wish to download as part of your project',
					  		      name: 'metadata',
					  		      choices: unpackagedChoices,
					  		      validate: function( answer ) {
					  		        if ( answer.length < 1 ) {
					  		          return 'You must choose at least one metadata type.';
					  		        }
					  		        return true;
					  		      }
					  		    }
					  		  ], function(answers) {
					  		  	userInput = merge.recursive(answers, userInput);
					  		  	// sfdcClient.retrieveUnpackaged(answers.metadata);	
					  		  });	
						  	}
						  });	
						})
						['catch'](function(error) {
							// console.log('error!');
							console.log(error);
						})
						['finally'](function() {
							// console.log('done!');
						});
				});
			}				
		});
	
};