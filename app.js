var app = require("express")();
var http = require("http").Server(app);
var io = require("socket.io")(http);

app.get("/", function (req, res) {
  res.sendFile(__dirname + "/index.html");
});

//Initialize variables;
var remainingWordList = [];
var usedWordList = [];

//Users
var globalUpdateUser = {
  clients: 0,
  userNames: [],
}
//WordList
var globalUpdateWord = {
  currentWord: "word",
  currentWordIndex: -1, //Increments before each word, so first one is 0
  remainingNumberOfWords: 0,
  numberCorrect: 0
}
//Score
var globalUpdateScore = {
  team1Score: 0,
  team2Score: 0
}
//GameFunction
var globalUpdateGame = {
  gameState: "WAITFORSTART",
  gameIsStarted: false,
  moiTurnLock: true,
  moiTurnUser: "",
  numberOfRounds: 0,
}



/*
* -----------------------------------------------------------------------
* Whenever a new user connects, this code gets executed
* This section listens for a connection by a client, before executing
* "connection" is a reserved object by the server
* ------------------------------------------------------------------------
*/

io.on("connection", function (socket) {

  /*
  * ---------------------------------------------------------------------
  * INCREMENT SERVER USER NUMBER
  * This section updates the console with client information.
  * ---------------------------------------------------------------------
  */

  //Increase number of clients connected to server
  globalUpdateUser.clients++;
  //Communicate to Server host the number of connected clients
  console.log("New User: " + globalUpdateUser.clients + " users are connected");
  /*
  * ---------------------------------------------------------------------
  * SET UP USERNAME
  * This Listener received a user name from the client and makes
  * sure it is unique before saving it. It will request another
  * username if this one already username exists. If successful,
  * a clientUpdate is called for All Users.
  * ---------------------------------------------------------------------
  */

  socket.on("clientUsername", function(data) {
     //If username is not found in array, returns -1
    if ( globalUpdateUser.userNames.indexOf(data) == -1) {
       globalUpdateUser.userNames.push(data);
       socket.emit("userIsAvailable", data );
       clientUpdate ("All Users", "globalUpdateUser", globalUpdateUser);

    //   console.log (globalUpdateUser.userNames);
    } else {
       socket.emit('userAlreadyExists', 'This name already exists.');
    }
  });

  // Triggered when a client leaves the game, removes username from userNames
  // by requesting usernames from currently connected user and recompiles
  // a list.

  socket.on("clientUsernameRefresh", function (data) {
      if (data) {
        globalUpdateUser.userNames.push(data);
      }
      if ( globalUpdateUser.userNames.length == globalUpdateUser.clients ) {
        clientUpdate ("All Users", "globalUpdateUser", globalUpdateUser);
      }
    });

  /*
  * ---------------------------------------------------------------------
  * GAME COMMANDS -> clientUpdateGame -> globalUpdateXXXX
  *  - INITIALIZEGAME
  *  - STARTGAME
  *  - NEXTROUND
  *  - FINALSCORE
  *  - ENDGAME
  *  - LOCKMOITURN
  *  - UNLOCKMOITURN
  *  - GIVETURNAUTHORITY
  *  - REMOVETURNAUTHORITY
  * This Listener received a clientUpdateGame from the client and sends
  * events particular to each game engine action
  * ---------------------------------------------------------------------
  */

  socket.on("clientUpdateGame", function (data) {
    switch (data.command) {
      case "INITIALIZEGAME":
        clientUpdate ("Just Me", "globalUpdateUser", globalUpdateUser);
        clientUpdate ("Just Me", "globalUpdateScore", globalUpdateScore);

        if (globalUpdateGame.gameIsStarted) {
          var tempUpdateGame = {
            gameState: "STARTGAME",
            gameIsStarted: globalUpdateGame.gameIsStarted,
            moiTurnLock: globalUpdateGame.moiTurnLock,
            moiTurnUser: globalUpdateGame.moiTurnUser,
            numberOfRounds: globalUpdateGame.numberOfRounds
          }
          clientUpdate ("Just Me", "globalUpdateGame", tempUpdateGame);
        }

        clientUpdate ("Just Me", "globalUpdateGame", globalUpdateGame);
        console.log("INITIALIZEGAME");

        break;
      case "STARTGAME":
        globalUpdateGame.gameState = "STARTGAME";
        globalUpdateGame.gameIsStarted = true;
        globalUpdateGame.moiTurnLock = false;
        globalUpdateGame.numberOfRounds++;
        globalUpdateWord.currentWord = "Placeholder";
        globalUpdateWord.numberCorrect = 0;
        suffleDeck (remainingWordList);
        //TODO - prevent new words from being added to remainingWordList
        clientUpdate ("All Users", "globalUpdateGame", globalUpdateGame);
        clientUpdate ("All Users", "globalUpdateWord", globalUpdateWord);
        console.log (data.userName + " clicked " + data.command);
        break;
      case "LOCKMOITURN":
        globalUpdateGame.moiTurnLock = true;
        globalUpdateGame.moiTurnUser = data.userName;
        globalUpdateGame.gameState = "LOCKMOITURN";
        clientUpdate ("All Users", "globalUpdateGame", globalUpdateGame);
        console.log (data.userName + " clicked " + data.command);
        break;
      case "UNLOCKMOITURN":
        globalUpdateGame.moiTurnLock = false;
        globalUpdateGame.moiTurnUser = "";
        globalUpdateGame.gameState = "UNLOCKMOITURN";
        suffleDeck (remainingWordList); // Shuffles remainingWordList
        globalUpdateWord.numberCorrect = 0;
        globalUpdateWord.currentWordIndex = -1; // Reset back to start of deck
        clientUpdate ("All Users", "globalUpdateWord", globalUpdateWord);
        clientUpdate ("All Users", "globalUpdateGame", globalUpdateGame);
        console.log (data.userName + " clicked " + data.command);
        break;
      case "NEXTROUND":
        globalUpdateGame.numberOfRounds++;
        globalUpdateGame.gameState = "NEXTROUND";
        remainingWordList = [];
        remainingWordList.push(...usedWordList);
        usedWordList = [];
        globalUpdateWord.currentWord = "Placeholder";
        globalUpdateWord.numberCorrect = 0;
        globalUpdateWord.remainingNumberOfWords = remainingWordList.length;
        //Void myTurnAuthority if forgot to remove, which is likely
        globalUpdateGame.moiTurnLock = false;
        globalUpdateGame.moiTurnUser = "";
        //Prepare Deck
        suffleDeck (remainingWordList); // Shuffles remainingWordList
        globalUpdateWord.currentWordIndex = -1; // Reset back to start of deck
        clientUpdate ("All Users", "globalUpdateWord", globalUpdateWord);
        clientUpdate ("All Users", "globalUpdateGame", globalUpdateGame);
        console.log (data.userName + " clicked " + data.command);
        break;
      case "ENDGAME":
        //Game is ended and values are reset
        //globalUpdateGame
        globalUpdateGame.gameState = "ENDGAME";
        globalUpdateGame.gameIsStarted = false;
        globalUpdateGame.moiTurnLock = true;
        globalUpdateGame.moiTurnUser = "";
        globalUpdateGame.numberOfRounds = 0;
        //globalUpdateScore
        globalUpdateScore.team1Score = 0;
        globalUpdateScore.team2Score = 0;
        //globalUpdateWord
        globalUpdateWord.currentWord = "word";
        globalUpdateWord.currentWordIndex = -1;
        globalUpdateWord.remainingNumberOfWords = 0;
        globalUpdateWord.numberCorrect = 0;
        //lists
        remainingWordList = [];
        usedWordList = [];
        clientUpdate ("All Users", "globalUpdateWord", globalUpdateWord);
        clientUpdate ("All Users", "globalUpdateScore", globalUpdateScore);
        clientUpdate ("All Users", "globalUpdateGame", globalUpdateGame);
        console.log (data.userName + " clicked " + data.command);
        break;
    }
  });


  /*
  * ---------------------------------------------------------------------
  * clientGotIt -> globalUpdateWord
  * This Listener activates when the client clicks Got It! button.
  * currentWord is removed from remainingWordList and moved to usedWordList
  * Remaining words are moved up the array. Therefore currentWordIndex
  * does not need to be incremented. Same currentWordIndex give next word
  * ---------------------------------------------------------------------
  */

  socket.on("clientGotIt", function (data) {

    var w = ""; //Temp current word
    var len = remainingWordList.length; //Remaining Word List length;
    var i = globalUpdateWord.currentWordIndex;

    //When receiving i from 0 to second from the end of array

    if ( (len) && (i >= 0) && (i < len-1) ) {
      w = remainingWordList.splice(i, 1); //removes current word from list
      usedWordList.push(w); //Addes current word to used list
      globalUpdateWord.currentWord = remainingWordList[i];
      globalUpdateWord.remainingNumberOfWords = remainingWordList.length;
      globalUpdateWord.numberCorrect++;
      clientUpdate ("All Users", "globalUpdateWord", globalUpdateWord);

      console.log (data.userName + " clicked Got It!");
    }

    //When receving the last entry in the array

    if ( (len) && (i == len-1) ) {
      w = remainingWordList.splice(i, 1); //removes current word from list
      usedWordList.push(w); //Addes current word to used list
      globalUpdateWord.currentWord = "End of List";
      globalUpdateWord.remainingNumberOfWords = remainingWordList.length;
      globalUpdateWord.numberCorrect++;
      clientUpdate ("All Users", "globalUpdateWord", globalUpdateWord);

      console.log (data.userName + " clicked Got It!");
    }

  });

  /*
  * ---------------------------------------------------------------------
  * clientNextWord -> globalUpdateWord
  * This Listener activates when the client clicks Next Word button.
  * currentWordIndex is incremented and next word is given;
  * ---------------------------------------------------------------------
  */

  socket.on("clientNextWord", function (data) {

    var w = ""; //Temp current word
    var len = remainingWordList.length; //Remaining Word List length;
    var i = globalUpdateWord.currentWordIndex;

    //Receives i from -1 to second from last word i + 1 for next word

    if ( (len) && (i+1 >= 0) && (i+1 < len) ) {
      globalUpdateWord.currentWordIndex++;
      w = remainingWordList[globalUpdateWord.currentWordIndex];
      globalUpdateWord.currentWord = w;
      clientUpdate ("All Users", "globalUpdateWord", globalUpdateWord);
      console.log (data.userName + " clicked Next Word");
    }

    //Receives last word and Receives empty wordList upon UNLOCKMOITURN

    if ( ( (len) && (i+1 == len) ) || ( (!len) && (i == -1) ) ) {
      globalUpdateWord.currentWordIndex++;
      globalUpdateWord.currentWord = "End of List";
      clientUpdate ("All Users", "globalUpdateWord", globalUpdateWord);
      console.log (data.userName + " clicked Next Word");
    }

  });

  /*
  *  ---------------------------------------------------------------------
  *  clientSubmitWords -> Add words to remainingWordList
  *  This Listener handles word inputs from the User
  *  1) Words are checked to see if they have return |n
  *  2) Data is converted to string then an array
  *  3) Array is concatinated to existing word list
  *  ---------------------------------------------------------------------
  */

  socket.on("clientSubmitWords", function(data) {

    //convert to String
    //var clientWordList = data.toString();
    //var clientWordArray = [];
    //var yesEnter = clientWordList.includes("\n");
    var w = "";

    //Check for enters
    if ( (!globalUpdateGame.gameIsStarted) ) {
      //Convert String to Array, split on \n character
      //clientWordArray = clientWordList.split("\n");

      //Remove any null entries in Array
      //clientWordArray = clientWordArray.filter(function (e) {return e});

      //Concat to wordList
      remainingWordList.push(data);

      //Send back confirmation
      socket.emit("clientSubmitWordsConfirmation", {
        eventSuccess: 1,
        message: "Person Received"
      });

      var len = remainingWordList.length;
    }

    });

  /*
  * ---------------------------------------------------------------------
  * This function will emit an update to users with given inputs
  * "Default" - This will be sent to all users, NOT including calling user
  * "All Users" - This will be sent to all users, including calling user
  * ---------------------------------------------------------------------
  */

  function clientUpdate ( audience , anEvent , data ) {
    if (audience == "Everyone Else") {
      io.sockets.emit( anEvent , data );
    }
    else if (audience == "All Users") {
      socket.emit( anEvent , data );
      io.sockets.emit( anEvent , data );
    }
    else if (audience == "Just Me") {
      socket.emit( anEvent , data );
    }
  }

  //Whenever someone disconnects, this gets executed
  //This is listening for an event on the client side
  //I think "disconnect" is a reserved event by the server.
  socket.on("disconnect", function () {
    //Decrease the number of clients connected to server

    //Refresh active users
    globalUpdateUser.clients--;
    globalUpdateUser.userNames = [];
    io.sockets.emit( "serverUsernameRefresh");

    //Communcate to Server host the number of connected clients
    console.log("User Left: " + globalUpdateUser.clients + " users are connected");
  });
});

//Establish listening port
var appPort = require("./currentPort.js");
http.listen(appPort, function () {
  console.log("Node.js web server at port " + appPort + " is running...");
}); // 3 - listen for any incoming requests

/*
* ---------------------------------------------------------------------
* FUNCTION: suffleDeck
* INPUT - 1D Array
* RETURN - 1D Array
* This function will suffle any array using the Fisher-Yates shuffle
* method found here: //https://bost.ocks.org/mike/shuffle/
*
* NOTE: Javascript passes Array to function as an "assign by reference"
* because Array (and Objects) are compound values. Therefore, what
* happens to "deck" happens to the array passed to the function and
* does not need a return.
* NOTE: Scalar primitive values (Number, String, Boolean, undefined, null,
* Symbol) are assigned-by-value and do need a return for changes in
* function to apply to variable passed to the function.
* https://medium.com/@naveenkarippai/learning-how-references-work-in-javascript-a066a4e15600
* ---------------------------------------------------------------------
*/

function suffleDeck (deck) {
  if (deck.length <= 1) return deck;
  var m = deck.length;
  var i, t = 0;

  // While there remain elements to shuffle…
  while (m) {

    // Pick a remaining element…
    i = Math.floor(Math.random() * m--);

    // And swap it with the current element.
    t = deck[m];
    deck[m] = deck[i];
    deck[i] = t;
  }
}
