'use strict';

const AWS = require('aws-sdk'); // eslint-disable-line import/no-extraneous-dependencies

const dynamoDb = new AWS.DynamoDB.DocumentClient();

module.exports.calculate = async (event, context) => { 
  const timestamp = new Date().getTime();

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

  if (fetchExistingElection.Item.ballotBox.length === 0) {
    console.error("This elections has not received any votes.");

    return {
      statusCode: 404,
      body: JSON.stringify({
        message: "This elections has not received any votes.",
      }),
    };
  }

  const calculateResults = (ballots, winnerCount) => {
    let winnersArray = [];
    let calculationRecord = [];
  
    // Loops the same number of times as the number of winners to be chosen
    while (winnersArray.length < winnerCount) {
      // Removes all already-won candidates from the ballots
      let roundBallots = ballots.map(ballot => ballot.filter(candidate => !(winnersArray.includes(candidate))));
  
      // variable to store the 'history' of the ballot counting process
      let roundCalculationRecord = [];
  
      // iterative loop until all but 1 candidate has been illiminated
      while (roundBallots[0].length > 1) {
        let remainingCandidates = roundBallots[0];
  
        // initiates an object with all the candidates as keys and 0-filled arrays (of length equalling number of candidates left) as values
        let candidatesDict = remainingCandidates.reduce((acc, cur) => ({...acc, [cur]: Array(roundBallots[0].length).fill(0)}), {})
  
        // goes through each ballot to record the number of each preference votes for each candidate
        roundBallots.forEach(ballot => {
          ballot.forEach((candidate, index) => {
            candidatesDict[candidate][index] += 1
          })
        });
  
        // add vote counts from this candidate elimination round to calculation history
        roundCalculationRecord.push(candidatesDict);
  
        // finds the name of candidate with the least number of votes
        let candidateToElim = remainingCandidates.reduce((acc, cur) => {
          if (cur === remainingCandidates[0]) {
            return acc;
          }
  
          for (let index = 0; index < roundBallots[0].length; index++) {
            if (candidatesDict[acc][index] !== candidatesDict[cur][index]) {
              return (candidatesDict[acc][index] < candidatesDict[cur][index] ? acc : cur)
            }
          }
        }, remainingCandidates[0]);
  
        // removes the candidate with the least votes from the ballots
        roundBallots = roundBallots.map(ballot => ballot.filter(candidate => !(candidate === candidateToElim)))
      }
  
      // add calculation records from this winner round to calculationRecord
      calculationRecord.push(roundCalculationRecord);
      
      // add the last standing candidate to winnersArray
      winnersArray.push(roundBallots[0][0]);
    }
    
    return [winnersArray, calculationRecord]
  };

  let [winnersArray, calculationRecord] = calculateResults(fetchExistingElection.Item.ballotBox, fetchExistingElection.Item.winnerCount);

  const params = {
    TableName: process.env.DYNAMODB_TABLE,
    Key: {
      id: event.pathParameters.id,
    },
    UpdateExpression: "SET calculatedAt = :calculatedAt, winnersArray = :winnersArray, calculationRecord = :calculationRecord",
    ExpressionAttributeValues: {
      ":calculatedAt": timestamp,
      ":winnersArray": winnersArray,
      ":calculationRecord": calculationRecord
    },
    ReturnValues: 'ALL_NEW',
  };

  try {
    const request = await dynamoDb.update(params).promise();

    return { 
      statusCode: 200, 
      body: JSON.stringify(request.Attributes)
    };
  } catch (err) {
    console.error(err)
    return {
      statusCode: 400,
      error: "Error calculating results of the election."
    };
  }
}