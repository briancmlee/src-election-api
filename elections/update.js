'use strict';

const AWS = require('aws-sdk'); // eslint-disable-line import/no-extraneous-dependencies

const dynamoDb = new AWS.DynamoDB.DocumentClient();

module.exports.update = async (event, context) => {
  const timestamp = new Date().getTime();
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

  if (Date.now() > fetchExistingElection.Item["voteOpen"] && (!(data.force))) {
    console.error("Elections cannot be edited after voting opens.")

    return {
      statusCode: 401,
      body: "Elections cannot be edited after voting opens."
    }
  }

  const editableProps = [
    "candidates",
    "winnerCount",
    "spectators",
    "voteClose",
    "voteOpen",
    "description",
    "voters",
    "title"
  ]

  let newProps = editableProps.reduce((acc, cur) => ({...acc, [cur]: data[cur] ? data[cur] : fetchExistingElection.Item[cur]}), {})

  const validationTests = {
    titleExist: (newProps.title !== "") || (typeof newProps.title !== "undefined"),
    titleType: typeof newProps.title === "string",
    titleRange: newProps.title.length <= 30,
    descExist: typeof newProps.description !== "undefined",
    descType: typeof newProps.description === "string",
    descRange: newProps.description.length <= 500,
    voteOpenExist: typeof newProps.voteOpen !== "undefined",
    voteOpenType: typeof newProps.voteOpen === "number",
    voteCloseExist: typeof newProps.voteClose !== "undefined",
    voteCloseType: typeof newProps.voteClose === "number",
    voteOpenCloseCheck: newProps.voteClose > newProps.voteOpen,
    winnerCountExist: typeof newProps.winnerCount !== "undefined",
    winnerCountType: typeof newProps.winnerCount === "number",
    winnerCountRange: (newProps.winnerCount > 0) && (newProps.winnerCount % 1 === 0) && (newProps.winnerCount < newProps.candidates.length),
    votersExist: typeof newProps.voters !== "undefined",
    votersType: typeof newProps.voters === "object",
    votersRange: newProps.voters.length > 0,
    spectatorsExist: typeof newProps.spectators !== "undefined",
    spectatorsType: typeof newProps.spectators === "object",
    candidatesExist: typeof newProps.candidates !== "undefined",
    candidatesType: typeof newProps.candidates === "object",
    candidatesRange: newProps.candidates.length > 0
  };

  const validationResult = Object.keys(validationTests).filter(test => !(validationTests[test]));

  if (validationResult.length > 0) {
    console.error("Validation Failed");

    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Election could not be edited due to invalid params.",
        validationFailed: validationResult,
      }),
    };
  }

  const params = {
    TableName: process.env.DYNAMODB_TABLE,
    Key: {
      id: event.pathParameters.id,
    },
    UpdateExpression: 'SET ' + editableProps.reduce((acc, cur) => (acc + `${cur} = :${cur}, `), "") + "voterRoll = :voterRoll, updatedAt = :updatedAt",
    ExpressionAttributeValues: {
      ...(editableProps.reduce((acc, cur) => ({...acc, [`:${cur}`]: newProps[cur]}), {})),
      ":voterRoll": newProps.voters.reduce((acc, cur) => ({...acc, [cur]: 0}), {}),
      ":updatedAt": timestamp
    },
    ReturnValues: 'ALL_NEW',
  };

  try {
    const request = await dynamoDb.update(params).promise();
    return { 
      statusCode: 200, 
      body: JSON.stringify(data)
    };
  } catch (err) {
    console.error(err)
    return {
      statusCode: 400,
      error: "Error creating the election."
    };
  }
};
