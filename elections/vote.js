'use strict';

const AWS = require('aws-sdk'); // eslint-disable-line import/no-extraneous-dependencies
const _ = require("lodash");

const dynamoDb = new AWS.DynamoDB.DocumentClient();

module.exports.vote = async (event, context) => {
  const data = JSON.parse(event.body);

  let fetchExistingElection = await dynamoDb.get({
    TableName: process.env.DYNAMODB_TABLE,
    Key: {
      id: event.pathParameters.id,
    },
  }).promise();
  
  if (!(fetchExistingElection.Item)) {
    console.error("This election does not exist.");

    return {
      statusCode: 404,
      body: JSON.stringify({
        message: "This election does not exist.",
      }),
    };
  }

  const validationTests = {
    unameExist: (data.username !== "") || (typeof data.username !== "undefined"),
    unameType: typeof data.username === "string",
    ballotExist: typeof data.ballot !== "undefined",
    ballotType: typeof data.ballot === "object",
    ballotRange: data.ballot.length === fetchExistingElection.Item["candidates"].length,
    ballotCandidate: _.isEqual((data.ballot).slice().sort(), (fetchExistingElection.Item["candidates"]).slice().sort())
  }

  const validationResult = Object.keys(validationTests).filter(test => !(validationTests[test]));

  // validation
  if (validationResult.length > 0) {
    console.error("Validation Failed");

    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "The request parameters are invalid.",
        validationFailed: validationResult,
      }),
    };
  }

  if ((Date.now() < fetchExistingElection.Item["voteOpen"]) || ((Date.now() > fetchExistingElection.Item["voteClose"]))) {
    console.error("Voting currently not open.");

    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Voting currently not open."
      }),
    };
  }

  if (!(data.username in fetchExistingElection.Item["voterRoll"])) {
    console.error("This user is not a voter for this election");

    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "This user is not a voter for this election"
      }),
    };
  } else if (fetchExistingElection.Item["voterRoll"][data.username] === 1) {
    console.error("This user has already voted.");

    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "This user has already voted."
      }),
    };
  }

  let updatedVoterRoll = fetchExistingElection.Item["voterRoll"];
  updatedVoterRoll[data.username] = 1;

  const params = {
    TableName: process.env.DYNAMODB_TABLE,
    Key: {
      id: event.pathParameters.id,
    },
    UpdateExpression: 'SET ballotBox = list_append(ballotBox, :newBallot), voterRoll = :updatedVoterRoll',
    ExpressionAttributeValues: {
      ':newBallot': [data.ballot],
      ':updatedVoterRoll': updatedVoterRoll,
    },
    // UpdateExpression: 'SET ballotBox = :ballotBox, voterRoll = :voterRoll',
    ReturnValues: 'ALL_NEW',
  };

  try {
    const request = await dynamoDb.update(params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify(data.ballot),
    }
  } catch (err) {
    console.error(err)

    return {
      statusCode: err.statusCode || 501,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Couldn\'t submit vote to the election.',
    }
  }
};
