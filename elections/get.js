'use strict';

const AWS = require('aws-sdk'); // eslint-disable-line import/no-extraneous-dependencies

const dynamoDb = new AWS.DynamoDB.DocumentClient();

module.exports.get = async (event, context) => {
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

  const params = {
    TableName: process.env.DYNAMODB_TABLE,
    Key: {
      id: event.pathParameters.id,
    },
  };
  
  try {
    let electionData = await dynamoDb.get(params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify(electionData.Item),
    };
  } catch (err) {
    console.error("Error fetching election.")

    return {
      statusCode: 400,
      body: "Error fetching election."
    }
  }
};
