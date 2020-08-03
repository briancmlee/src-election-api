'use strict';

const AWS = require('aws-sdk'); // eslint-disable-line import/no-extraneous-dependencies

const dynamoDb = new AWS.DynamoDB.DocumentClient();

module.exports.create = async (event, context) => {
  const timestamp = new Date().getTime();
  const data = JSON.parse(event.body);

  // Fetch an existing Election with the specified ID if it exists. If not, this is empty
  let fetchExistingElection = await dynamoDb.get({
    TableName: process.env.DYNAMODB_TABLE,
    Key: {
      id: data.id,
    },
  }).promise();

  // If an Election with the same ID already exists, return error and terminate request
  if (fetchExistingElection.Item) {
    console.error("An election with the same ID already exists.");

    return {
      statusCode: 409,
      body: JSON.stringify({
        message: "Election could not be created as another election with the same ID exists.",
      }),
    };
  }

  // Dictionary of validation tests for all fields of the request
  const validationTests = {
    idType: typeof data.id === "string",
    titleExist: (data.title !== "") || (typeof data.title !== "undefined"),
    titleType: typeof data.title === "string",
    titleRange: data.title.length <= 30,
    descExist: typeof data.description !== "undefined",
    descType: typeof data.description === "string",
    descRange: data.description.length <= 500,
    voteOpenExist: typeof data.voteOpen !== "undefined",
    voteOpenType: typeof data.voteOpen === "number",
    voteCloseExist: typeof data.voteClose !== "undefined",
    voteCloseType: typeof data.voteClose === "number",
    voteOpenCloseCheck: data.voteClose > data.voteOpen,
    winnerCountExist: typeof data.winnerCount !== "undefined",
    winnerCountType: typeof data.winnerCount === "number",
    winnerCountRange: (data.winnerCount > 0) && (data.winnerCount % 1 === 0) && (data.winnerCount < data.candidates.length),
    votersExist: typeof data.voters !== "undefined",
    votersType: typeof data.voters === "object",
    votersRange: data.voters.length > 0,
    spectatorsExist: typeof data.spectators !== "undefined",
    spectatorsType: typeof data.spectators === "object",
    candidatesExist: typeof data.candidates !== "undefined",
    candidatesType: typeof data.candidates === "object",
    candidatesRange: data.candidates.length > 0
  };

  // Reduce the validationTests to a list of name of validation tests that failed
  const validationResult = Object.keys(validationTests).filter(test => !(validationTests[test]));

  // If there are any validation tests failed, return error
  if (validationResult.length > 0) {
    console.error("Validation Failed");

    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Election could not be created due to invalid params.",
        validationFailed: validationResult,
      }),
    };
  }

  const params = {
    TableName: process.env.DYNAMODB_TABLE,
    Item: {
      id: data.id,
      title: data.title,
      description: data.description,
      voteOpen: data.voteOpen,
      voteClose: data.voteClose,
      winnerCount: data.winnerCount,
      voters: data.voters,
      voterRoll: data.voters.reduce((acc, cur) => ({...acc, [cur]: 0}), {}),
      ballotBox: [],
      spectators: data.spectators,
      candidates: data.candidates,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  };

  // create Election or catch error
  try {
    const request = await dynamoDb.put(params).promise();
    console.log(request);
    return { 
      statusCode: 200, 
      body: JSON.stringify(params.Item)
    };
  } catch (err) {
    console.error(err)
    return {
      statusCode: 400,
      error: "Error creating the election."
    };
  }
};
