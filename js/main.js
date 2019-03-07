
window.onload = function () {

    // TODO:: Do your initialization job

    // add eventListener for tizenhwkey
    document.addEventListener('tizenhwkey', function(e) {
    	if(e.keyName === "back") {
    		try {
    			tizen.application.getCurrentApplication().exit();
    		}
    		catch (ignore) {
    		}
    	}
    });
};

	// function to load cookies
	function getCookieValue(a) {
		var b = document.cookie.match('(^|;)\\s*' + a + '\\s*=\\s*([^;]+)');
		return b ? b.pop() : '';
	}

	// set to true for debugging
	var debug = true;
	//var debug = false;
	
	// this is the interact/output element
	var content = document.getElementById('content');
	
	// Chess interaction functions (chess.js); this comes with no engine!
	var chess = new Chess();	
	
	// initalize the engine (stockfish.js)
	var stockfish = new Worker('js/stockfish/src/stockfish.js');
	stockfish.postMessage("ucinewgame");
	stockfish.postMessage("isready");
	// read the response of the engine and ...
	stockfish.onmessage = function(event) { 
		// ... look for the keyword 'bestmove' ...
		if (/bestmove/.test(event.data)) {
			/// ... and extract/play it!
			var move = event.data.match(/bestmove (\S+)/)[1];
			play(move);
			// also, send this to the output-window 
			// TODO: how to write this to variable instead inside element??
			document.getElementById('result').textContent = move;
			// are we in check?
			if(chess.in_check()) {
				content.classList.add('inCheck');
			}
			else {
				content.classList.remove('inCheck');
			}
	};
	}
	
	// provide select-box
	var select;
	function initialize_select() {
			select = document.createElement("select");
			content.appendChild(select);
			select.options.length = 0;
			select.options[select.options.length] = new Option("--", 0);
	}

						
	// function to check if a given "move", i.e. file/rank combination
	// is in the movelist. Returns all moves foudn.
	function find_moves(move, movelist) {
		var curmoves = [];
		// exception: castling
		if (move.match(/-O/)) {
			curmoves[0] = move;
		}
		else {
			var re = new RegExp(move, 'g');
			movelist.forEach(function(m) {
				if (m.match(re)) {
					curmoves.push(m);
				}
			})
		}
		return curmoves;
	}
	
	// Player's turn
	// Move selection is done in three steps:
	// a) select file where to move
	// b) select rank where to move
	// c) select piece to move (optional, only if more than one can move to selection)
	
	var moveF, moveR; // variables to store target square (file and rank)
	function turn_player() {

			var moves = chess.moves();
						
			// first, create a list with all possible target squares
			var squares = [];
			moves.forEach(function(m) {
				var mlast = m.replace('+','');  // remove check mark '+'
				 // if length gt 2 (no pawn move), more characters are included;
				 // remove them; exception: castling
				if (mlast.length>2 & !mlast.match(/-O/)) {
					mlast = mlast.slice(-2);
				}
				if (!squares.includes(mlast)) {
					squares.push(mlast);
				}
			})

			// second, provide select-box for file == a)
			initialize_select();
			var files = [];
			squares.forEach(function(m) {
				var x = m.slice(0,1);
				// exception: castling
				if (m.match(/-O/)) {
					x = m;
				}
				if (!files.includes(x)) {
					files.push(x);
				}
			})
			for(index in files.sort()) {
				select.options[select.options.length] = new Option(files[index], index+1);
			}
			// on change of the select: store file, proceed
			select.addEventListener("change", function(){
				moveF = select.options[select.selectedIndex].text;
				select.remove();
				
				// third, provide select-box for rank == b), if necessary
				var curmoves = find_moves(moveF,moves);
				// is this the only move? Then execute
				if (curmoves.length==1) {
					play(curmoves[0]);
					run();
				}
				else {				
					initialize_select();
					var ranks = [];
					// narrow selection to ranks in the selected file
					var narrowedSquares = [];
					var re = new RegExp(moveF, 'g');
					squares.forEach(function(m) {
						if (m.match(re)) {
							narrowedSquares.push(m);
						}
					})
					narrowedSquares.forEach(function(m) {
						var x = m.slice(1);
						if (!ranks.includes(x)) {
							ranks.push(x);
						}
					})
					for(index in ranks.sort()) {
						select.options[select.options.length] = new Option(ranks[index], index+1);
					}
					// on change of the select: store rank, proceed
					select.addEventListener("change", function(){
						moveR = select.options[select.selectedIndex].text;
						select.remove();
	
						// now lets try if we are finished
						var curmoves = find_moves(moveF+moveR,moves);
						// is this the only move? Then execute
						if (curmoves.length==1) {
							play(curmoves[0]);
							run();
						}
						// otherwise, we need to be some more specific
						else {
							initialize_select();
							for(index in curmoves.sort()) {
								select.options[select.options.length] = new Option(curmoves[index], index+1);
							}
							// on change of the select: go!
							select.addEventListener("change", function(){
								play(select.options[select.selectedIndex].text);
								run();
								select.remove();
							});
						}
					});				
				}
			});
	}

	// Engine's turn
	function turn_engine() {
		// send the current situation to the engine (evaluate this!)
		stockfish.postMessage("position fen "+ chess.fen());
		stockfish.postMessage("go depth 1");
		stockfish.postMessage("isready");

		// provide feedback element
		var result = document.createElement("p");
		content.appendChild(result);
		result.id = "result";
		// on click: remove feedback element, new turn
		result.addEventListener("click", function(){
			result.remove();
			run();
		});
	}

	// Print some debugging
	function fill_debug(move) {
		if (debug) {
			var log = "<pre>" + chess.ascii() + "</pre>";
			log = log + "<br/>" + "played: " + move;
			log = log + "<br/>" + "History: " + chess.pgn(); 
			if (chess.in_check()) {
				log = log + "<br/>" + "Check!"; 
			}
			if (chess.in_checkmate()) {
				log = log + "<br/>" + "Checkmate!"; 
			}
			if (chess.in_stalemate()) {
				log = log + "<br/>" + "Stalemate!"; 
			}
			document.getElementById('debug').innerHTML= log;
		}
	}
	
	// Little helper: execute one single move
	function play(move) {
		chess.move(move, {sloppy: true});
		fill_debug(move);
	}

	// play one turn
	function run() {
		
		// only proceed if it is not game-over yet!
		if(chess.game_over()) {
		
			// 1) checkmate?
			if(chess.in_checkmate()) {
				var result = document.createElement("p");
				result.innerHTML = "Checkmate!";
				content.appendChild(result);
			}

			// 2) stalemate?
			if(chess.in_stalemate()) {
				var result = document.createElement("p");
				result.innerHTML = "Stalemate!";
				content.appendChild(result);
			}

			// 3) draw?
			if(chess.in_draw() | chess.in_threefold_repetition()) {
				var result = document.createElement("p");
				result.innerHTML = "Draw!";
				content.appendChild(result);
			}		
		}
		else { // not yet game-over
			
			// play the side on turn
			if (chess.turn() == playerColor) {
				turn_player();
			}
			else {
				turn_engine();
			}		
			
			// save
			document.cookie = "pgn=" + chess.pgn();
			document.cookie = "playerColor=" + playerColor;
		}
	}

	
	// Begin the game. Either choose white or black, or load a previously interrupted game.
	var playerColor = "w"; //initialize playerColor with white
	function start() {

		// Box for black
		var b = document.getElementById('chooseBlack');
		b.addEventListener("click", function(){
				playerColor = "b";
		});

		// Box for white
		var w = document.getElementById('chooseWhite');
		w.addEventListener("click", function(){
				playerColor = "w";
		});

		// Box for Load game
		var l = document.getElementById('chooseLoad');
		l.addEventListener("click", function(){
				chess.load_pgn(getCookieValue("pgn"), {sloppy:true});
				// Test castling
				//chess.load_pgn("1. e4 e6 2. Nf3 d6 3. Bb5+ c6 4. Qe2 f6 5. b4 cxb5 6. Ba3 a6 7. Nc3 Ne7", {sloppy:true});
				// Test en passant
				//chess.load_pgn("1. e4 e6 2. e5 d5", {sloppy:true});
				playerColor = getCookieValue("playerColor");
		});

		// on click (regardless which option), remove this startbox
		// and begin with the game!
		var s = document.getElementById('startmenu');
		s.addEventListener("click", function(){
				s.remove();
				fill_debug("");
				run();
		});
	}
	
	// initalize/setup/start with the game
	start();
