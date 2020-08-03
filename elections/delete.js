'use strict';

const AWS = require('aws-sdk'); // eslint-disable-line import/no-extraneous-dependencies

const dynamoDb = new AWS.DynamoDB.DocumentClient();

module.exports.delete = async (event, context) => {
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

  if ((Date.now() > fetchExistingElection.Item["voteOpen"]) && (!(data.force))) {
    console.error("To delete an election after voting opens, the force flag must be set to true.")

    return {
      statusCode: 401,
      body: "To delete an election after voting opens, the force flag must be set to true."
    }
  }

  const params = {
    TableName: process.env.DYNAMODB_TABLE,
    Key: {
      id: event.pathParameters.id,
    },
  };

  try {
    let request = await dynamoDb.delete(params).promise()

    return {
      statusCode: 200,
      body: "Successfully deleted.",
    }
  } catch (err) {
    console.error(err);

    return {
      statusCode: err.statusCode || 501,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Couldn\'t remove the election.',
    }
  }
};
