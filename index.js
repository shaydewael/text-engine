const input = document.querySelector('#input');

// get random array element
const pickOne = arr => arr[Math.floor(Math.random() * arr.length)];

// return the first name if it's an array, or the only name
const getName = name => typeof name === 'object' ? name[0] : name;

const getCharactersInRoom = (roomId) => characters.filter(c => c.roomId === roomId);

document.onkeydown = () => {
  input.focus();
};

const loadDisk = (disk, config = {}) => {
  // build default (DOM) configuration
  const defaults = {
    // retrieve user input (remove whitespace at beginning or end)
    getInput: () => input.value.trim(),
    // overwrite user input
    setInput: (str) => {
      input.value = str;
    },
    // render output
    println: (line, isImg = false, isName = false, isDesc = false) => {
      // bail if string is null or undefined
      if (!line) {
        return;
      }

      // if this is an array of lines, pick one at random
      str = typeof line === 'object' ? pickOne(line) : line;

      const output = document.querySelector('#output');
      const newLine = document.createElement('div');

      if (isImg) {
        newLine.classList.add('img');
      }

      if (isName) {
        newLine.classList.add('roomname');
      }

      if (isDesc) {
        newLine.classList.add('desc');
      }

      // add a class for styling prior user input
      if (line[0] === '>') {
        newLine.classList.add('user');
      }

      output.appendChild(newLine).innerText = str;
      window.scrollTo(0, document.body.scrollHeight);
    },
    // prepare the environment
    setup: ({applyInput = (() => {}), navigateHistory = (() => {})}) => {
      input.onkeypress = (e) => {
        const ENTER = 13;

        if (e.keyCode === ENTER) {
          applyInput();
        }
      };

      input.onkeydown = (e) => {
        const UP = 38;
        const DOWN = 40;

        if (e.keyCode === UP) {
          navigateHistory('prev');
        } else if (e.keyCode === DOWN) {
          navigateHistory('next');
        }
      };
    }
  };

  // Debugging: Allow pressing > to force characters to move to adjacent rooms.
  document.onkeypress = function (e) {
    if(e.keyCode == 62){
      characters.map(c=>c.updateLocation({println,disk}));
    }
  };

  const {getInput, setInput, println, setup} = Object.assign(defaults, config);

  // Disk -> Disk
  const init = (disk) => {
    const initializedDisk = Object.assign({}, disk);
    initializedDisk.rooms = disk.rooms.map((room) => {
      room.visits = 0;
      return room;
    });

    if (!initializedDisk.inventory) {
      initializedDisk.inventory = [];
    }

    return initializedDisk;
  };

  disk = init(disk);

  const inputs = ['']; // store all user commands
  let inputsPos = 0;

  // String -> Room
  const getRoom = (id) => disk.rooms.find(room => room.id === id);

  const enterRoom = (id) => {
    const room = getRoom(id);

    println(room.img, true);

    println(`${getName(room.name)}`,false,true);

    if (room.visits === 0) {
      println(room.desc,false,false,true);
    }
    let characters = getCharactersInRoom(room.id);
    characters.map(c => println(`${c.name} is here.`,false,false,true))   

    room.visits++;

    disk.roomId = id;

    if (typeof room.onEnter === 'function') {
      room.onEnter({disk, println, getRoom, enterRoom});
    }

    // reset any active conversation
    delete disk.conversant;
  };

  const startGame = (disk) => {
    enterRoom(disk.roomId);
  };

  startGame(disk);

  const applyInput = () => {
    const input = getInput();
    inputs.push(input);
    inputsPos = inputs.length;
    println('> ' + input);

    const val = input.toLowerCase();
    setInput(''); // reset input field

    const exec = (cmd) => {
      if (cmd) {
        cmd();
      } else {
        println('Sorry, I didn\'t understand your input. For a list of available commands, type HELP.');
      }
    };

    let args = val.split(' ')
      // remove articles
      .filter(arg => arg !== 'a' && arg !== 'an' && arg != 'the');

    if (disk.conversant && args.length === 1) {
      // if player is in a conversation, assume the argument is a topic
      args = ['talk', 'about', args[0]];
    }

    const cmd = args[0];
    const room = getRoom(disk.roomId);

    // nested strategy pattern
    // 1st tier based on # of args in user input
    // 2nd tier based on 1st arg (command)
    const strategy = {
      1() {
        const cmds = {
          inv() {
            if (!disk.inventory.length) {
              println('You don\'t have any items in your inventory.')
              return;
            }
            println('You have the following items in your inventory:');
            disk.inventory.forEach(item => {
              println(`* ${getName(item.name)}`);
            });
          },
          look() {
            println(room.desc,false,false,true);
          },
          go() {
            const exits = room.exits;
            if (!exits) {
              println('There\'s nowhere to go.');
              return;
            }
            println('Where would you like to go? Available directions are:');
            exits.forEach(exit => println(exit.dir));
          },
          take() {
            const items = (room.items || []).filter(item => item.isTakeable);
            if (!items.length) {
              println('There\'s nothing to take.');
              return;
            }
            println('What would you like to take? Available items are:');
            items
              .forEach(item => println(getName(item.name)));
          },
          items() {
            const items = (room.items || []);
            if (!items.length) {
              println('There\'s nothing here.');
              return;
            }
            println('You see the following:');
            items
              .forEach(item => println(getName(item.name)));
          },
          help() {
            const instructions = `
              The following commands are available:
              LOOK :: repeat room description
              LOOK AT [OBJECT NAME] e.g. 'look at key'
              TAKE [OBJECT NAME] e.g. 'take book'
              GO [DIRECTION] e.g. 'go north'
              USE [OBJECT NAME] e.g. 'use door'
              TALK TO [CHARACTER NAME] e.g. 'talk to mary'
              TALK ABOUT [SUBJECT] e.g. 'talk about horses'
              INV :: list inventory items
              HELP :: this help menu
            `;
            println(instructions);
          },
          say() {
            println([`Say what.`, `You don't say.`])
          },
          play() {
            println(`You're already playing a game.`);
          },
        };
        exec(cmds[cmd]);
      },
      2() {
        const cmds = {
          look() {
            println(`You look ${args[1]}.`);
          },
          go() {
            const exits = room.exits;
            if (!exits) {
              println('There\'s nowhere to go.');
              return;
            }
            const nextRoom = exits.find(exit => exit.dir === args[1]);
            if (!nextRoom) {
              println('There is no exit in that direction.');
            } else {
              enterRoom(nextRoom.id);
            }
          },
          take() {
            const findItem = item => item.name === args[1] || item.name.includes(args[1]);
            const itemIndex = room.items && room.items.findIndex(findItem);
            if (typeof itemIndex === 'number' && itemIndex > -1) {
              const item = room.items[itemIndex];
              if (item.isTakeable) {
                disk.inventory.push(item);
                room.items.splice(itemIndex, 1);
                println(`You took the ${getName(item.name)}.`);
                if (typeof item.onTake === 'function') {
                  item.onTake({disk, println, getRoom, enterRoom, item});
                }
              } else {
                println('You can\'t take that.');
              }
            } else {
              println('You don\'t see any such thing.');
            }
          },
          use() {
            const findItem = item => item.name === args[1] || item.name.includes(args[1]);
            const item = (room.items && room.items.find(findItem)) || disk.inventory.find(findItem);

            if (item) {
              if (item.use) {
                const use = typeof item.use === 'string' ? eval(item.use) : item.use;
                use({disk, println, getRoom, enterRoom, item}); // use item and give it a reference to the game
              } else {
                println('That item doesn\'t have a use.');
              }
            } else {
              println('You don\'t have that.');
            }
          },
          say() {
            println(`You say ${args[1]}.`);
          },
          play() {
            println(`You're already playing a game.`);
          },
        };
        exec(cmds[cmd]);
      },
      3() {
        const cmds = {
          look() {
            const findItem = item => item.name === args[2] || item.name.includes(args[2]);
            const item = (room.items && room.items.find(findItem)) || disk.inventory.find(findItem);
            if (item) {
              // Look at an item.
              if (item.desc) {
                println(item.desc);
              } else {
                println('You don\'t notice anythign remarkable about it.');
              }

              if (typeof(item.look) === 'function') {
                item.look({disk, println, getRoom, enterRoom, item});
              }
            } else {
              const character = getCharactersInRoom(room.id).find(c => c.name.toLowerCase() === args[2]);
              if (character) {
                // Look at a character.
                if (character.desc) {
                  println(character.desc);
                } else {
                  println('You don\'t notice anything remarkable about them.');
                }
              } else {
                println('You don\'t see any such thing.');
              }
            }
          },
          say() {
            const str = args.splice(1).reduce((cur, acc) => cur + ' ' + acc, `You say `) + '.';
            println(str);
          },
          talk() {
            let preposition = args[1];
            if (preposition !== 'to' && preposition !== 'about') {
              println(`You can talk TO someone or ABOUT some topic.`);
              return;
            }

            // get a character by name from a list of characters
            const findCharacter = (chars, name) => chars.map(c => c.name.toLowerCase()).includes(name.toLowerCase());

            const character =
              preposition === 'to' && findCharacter(characters, args[2]) ? eval(args[2])
              : disk.conversant;
            let topics;

            // give the player a list of topics to choose from for the character
            // (if this is a branching conversation, list possible responses)
            const listTopics = (character) => {
              disk.conversation = topics;

              if (Object.keys(topics).length) {
                if (character.conversationType === 'branching') {
                  println('Select a response:');
                  Object.keys(topics).forEach(topic => println(topics[topic].response));
                } else {
                  println('What would you like to discuss?');
                  Object.keys(topics).forEach(topic => println(topic));
                  println('NOTHING');
                }
              } else {
                endConversation();
              }
            };

            // end the current conversation
            const endConversation = () => {
              disk.conversant = undefined;
              disk.conversation = undefined;
              println('You politely end the conversation.')
            };

            if (preposition === 'to') {
              if (!findCharacter(characters, args[2])) {
                println('There is no one here by that name.');
                return;
              }

              if (!findCharacter(getCharactersInRoom(room.id), character.name)) {
                println('There is no one here by that name.');
                return;
              }

              topics = character.topics({println, room});

              if (!Object.keys(topics).length) {
                println(`You have nothing to discuss with ${character.name} at this time.`);
                return;
              }

              disk.conversant = character;
              listTopics(character);
            } else if (preposition === 'about'){
              if (!disk.conversant) {
                println('You need to be in a conversation to talk about something');
                return;
              }
              const character = eval(disk.conversant);
              if(getCharactersInRoom(room.id).includes(disk.conversant)){
                const response = disk.conversation[args[2]];
                if (args[2].toLowerCase() === 'nothing'){
                  endConversation();
                  return;
                } else if (response) {
                  if (character.conversationType === 'branching') {
                    const topics = disk.conversation;
                    topics[args[2]].onSelected();
                  } else {
                    if (typeof response === 'function'){
                      println(response());
                    } else {
                      println(response);
                    }
                  }
                } else {
                  println(`You talk about ${args[2]}.`);
                }

                // continue the conversation.
                topics = character.topics({println, room});
                listTopics(character);
              } else {
                println('That person is no longer available for conversation.')
                disk.conversant = undefined;
                disk.conversation = undefined;
              }
            }
          }
        };
 
        exec(cmds[cmd]);
      }
    };

    if (args.length <= 3) {
      strategy[args.length]();
    } else {
      strategy[3]();
    }
  };

  const navigateHistory = (dir) => {
    if (dir === 'prev') {
      inputsPos--;
      if (inputsPos < 0) {
        inputsPos = 0;
      }
    } else if (dir === 'next') {
      inputsPos++;
      if (inputsPos > inputs.length) {
        inputsPos = inputs.length;
      }
    }

    setInput(inputs[inputsPos] || '');
  };

  setup({applyInput, navigateHistory});
};

// npm support
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = loadDisk;
}
