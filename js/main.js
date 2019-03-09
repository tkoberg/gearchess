
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
	var debug = false;
	
	// this is the interact/output element
	var content = document.getElementById('content');
	if (debug) {
		content.style.border = '2px solid red'; 
	}

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
			enginemove.innerHTML= move;
			// are we in check?
			if(chess.in_check()) {
				content.classList.add('inCheck');
			}
			else {
				content.classList.remove('inCheck');
			}
	}
	};
	
	// provide select-box
	var select;
	/*
	function provide_select(selectlist, onchangefunction) {
			select = document.createElement("select");
			content.appendChild(select);
			select.options.length = 0;
			select.options[select.options.length] = new Option("--", 0);
			
			for(var index in selectlist.sort()) {
				select.options[select.options.length] = new Option(selectlist[index], index+1);
			}
			select.addEventListener("change", onchangefunction);
	}
	 */
	function provide_select(selectlist, onchangefunction) {
		select = document.createElement("ul");
		select.classList.add('circle');
		for(var index in selectlist.sort()) {
			var degree = Math.floor(360/(selectlist.length*45))*45*index; // TODO: Bug with 5 elements
			var circle_item = document.createElement("li");
			circle_item.innerHTML = selectlist[index];
			circle_item.classList.add('circle_item');
			if (selectlist[index]==="O") {
				circle_item.classList.add('degNaN');
			}
			else {
				circle_item.classList.add('deg'+degree);
			}
			circle_item.addEventListener("click", onchangefunction);
			select.appendChild(circle_item);
		}
		content.appendChild(select); 
	}
	
	// function to check if a given "move", i.e. file/rank combination
	// is in the movelist. Returns all moves found.
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
			});
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
				if (mlast.length>2 && !mlast.match(/-O/)) {
					mlast = mlast.slice(-2);
				}
				if (!squares.includes(mlast)) {
					squares.push(mlast);
				}
			});

			// second, provide select-box for file == a)
			var files = [];
			squares.forEach(function(m) {
				var x = m.slice(0,1);
				// exception: castling
				if (m.match(/-O/)) {
					x = "O";
				}
				if (!files.includes(x)) {
					files.push(x);
				}
			});
			provide_select(files, function() {
				// on change of the select: store file, proceed
				//moveF = select.options[select.selectedIndex].text;
				moveF = this.textContent;
				select.remove();
					
				// third, provide select-box for rank == b), if necessary
				var curmoves = find_moves(moveF,moves);
				// is this the only move? Then execute
				if (curmoves.length===1) {
					play(curmoves[0]);
					run();
				}
				else {				
					var ranks = [];
					// narrow selection to ranks in the selected file
					var narrowedSquares = [];
					var re = new RegExp(moveF, 'g');
					squares.forEach(function(m) {
						if (m.match(re)) {
							narrowedSquares.push(m);
						}
					});
					narrowedSquares.forEach(function(m) {
						var x = m.slice(1);
						if (!ranks.includes(x)) {
							ranks.push(x);
						}
					});
					
					// show first selection in center
					var centerselection = document.createElement("span");
					centerselection.innerHTML = moveF;
					centerselection.classList.add('centerselection');
					centerselection.addEventListener("click", function () {
						content.innerHTML = "";
						turn_player(); // on click, revert selection and start again
					});

					provide_select(ranks, function(){
						// on change of the select: store rank, proceed
						//moveR = select.options[select.selectedIndex].text;
						moveR = this.textContent;
						select.remove();

						// now lets try if we are finished
						var curmoves = find_moves(moveF+moveR,moves);
						// is this the only move? Then execute
						if (curmoves.length===1) {
							play(curmoves[0]);
							run();
						}
						// otherwise, we need to be some more specific
						else {
							provide_select(curmoves, function(){
								// on change of the select: go!
								//var foundmove = select.options[select.selectedIndex].text;
								var foundmove = this.textContent;
								select.remove();
								play(foundmove);
								run();
							});
						}
					});
					
					select.appendChild(centerselection); 
					
				}
			});				
	}
				

	// Engine's turn
	function turn_engine() {
		// send the current situation to the engine (evaluate this!)
		stockfish.postMessage("position fen "+ chess.fen());
		stockfish.postMessage("go depth 1");
		stockfish.postMessage("isready");

		// providing feedback is handled in stockfish.onmessage(...)
		// on click: remove feedback element, new turn
		var enginemove = document.createElement("span");
		content.appendChild(enginemove);
		enginemove.id = "enginemove";
		enginemove.addEventListener("click", function f(){
			enginemove.removeEventListener("click",f);
			content.innerHTML = "";
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
		
			var message = document.createElement("span");
			content.appendChild(message);
			message.id = "message";
			// on click, review the complete game
			message.addEventListener("click", function f(){
				message.id = "history";
				message.innerHTML = chess.pgn({ max_width: 5, newline_char: '<br />' });
			});

			message.innerHTML = "GameOver!";
			// 1) checkmate?
			if(chess.in_checkmate()) {
				message.innerHTML = "Check-mate!";
			}

			// 2) stalemate?
			if(chess.in_stalemate()) {
				message.innerHTML = "Stale-mate!";
			}

			// 3) draw?
			if(chess.in_draw() || chess.in_threefold_repetition()) {
				message.innerHTML = "Draw!";
			}		
		}
		else { // not yet game-over
			
			// play the side on turn
			if (chess.turn() === playerColor) {
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

	
	// Begin the game. Either choose white or black, 
	// or load a previously interrupted game.
	var playerColor = "w"; //initialize playerColor with white
	function start() {

		var s = document.getElementById('startmenu');

		// little helper: everything is set, now begin with the game
		function begin(pc){
			playerColor = pc;  // set playerColor
			s.remove(); // remove menue
			fill_debug(""); // debugging
			run(); // start the game
		}
			
		// Box for Load game
		var l = document.getElementById('lowermenuentry');
		l.classList.add("chooseLoad");
		l.innerHTML = "Load";
		l.addEventListener("click", load);
		function load(){
			// Load previously saved (==cookie) game
			chess.load_pgn(getCookieValue("pgn"), {sloppy:true}); begin(getCookieValue("playerColor"));
			
			// Test castling
			//chess.load_pgn("1. e4 e6 2. Nf3 d6 3. Bb5+ c6 4. Qe2 f6 5. b4 cxb5 6. Ba3 a6 7. Nc3 Ne7", {sloppy:true});begin("w");
			// Test en passant
			//chess.load_pgn("1. e4 e6 2. e5 d5", {sloppy:true});begin("w");
			// Test next move check, then checkmate
			//chess.load_pgn("1. e4 e6 2. Nf3 d6 3. Bb5+ c6 4. Qe2 f6 5. b4 cxb5 6. Ba3 a6 7. Nc3 Ne7 8. Kf1 Nbc6 9. Qxb5 axb5 10. Nd5 exd5 11. Ne5 dxe5 12. Rb1 Rxa3 13. Kg1 Rb3 14. Re1 d4 15. Re2", {sloppy:true});begin("w");
		}
		
		// Box for newGame
		var n = document.getElementById('uppermenuentry');
		n.classList.add("chooseNG");
		n.innerHTML = "New";
		n.addEventListener("click", function (){
			
			// remove event-listener of load game box,
			// otherwise we have two events fired!
			l.removeEventListener("click",load);

			// Box for white
			var w = document.getElementById('uppermenuentry');
			w.classList.add("chooseWhite");
			w.innerHTML = "White";
			w.addEventListener("click", function(){
					begin("w");
			});

			// Box for black
			var b = document.getElementById('lowermenuentry');
			b.classList.add("chooseBlack");
			b.innerHTML = "Black";
			b.addEventListener("click", function(){
					begin("b");
			});
		});

	}
	
	// initalize/setup/start with the game
	start();
