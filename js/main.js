
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

function save(key, value) {
	//document.cookie = key+"=" + value;
	localStorage.setItem(key, value);
	if(debug){
		console.log("Saved "+key+": "+value);
	}
}

function load(key) {
	//var b = document.cookie.match('(^|;)\\s*' + a + '\\s*=\\s*([^;]+)');
	//b = b ? b.pop() : '';
	var b = localStorage.getItem(key);
	if(debug){
		console.log("Loaded "+key+": "+b);
	}
	return b;
}


	// set to true for debugging
	var debug = 1;
	
	// this is the interact/output element
	var content = document.getElementById('content');
	if (debug) {
		content.style.border = '2px solid red'; 
	}

	// Chess interaction functions (chess.js); this comes with no engine!
	var chess = new Chess();	
	
	// initalize the engine (stockfish.js)
	var stockfish = new Worker('js/stockfish/src/stockfish.asm.js');
	stockfish.postMessage("ucinewgame");
	
	// read the response of the engine and ...
	var score=0;
	stockfish.onmessage = function(event) { 
		if(debug) { console.log(event.data); }
		
		// ... save the current centipawn score (= 1/100 pawn)
		if (/score cp/.test(event.data)) {
			score = event.data.match(/score cp (\S+)/)[1];
			score = score/100; // normalize (usual way to display)
			// if player is white, engine is black, so score must be inverted, because:
			// score cp == "the score from the engine's point of view in centipawns"
			if (playerColor === "w") { 
				score = -score;
			}
		}
		// ... or mate
		if (/mate/.test(event.data)) {
			score = event.data.match(/mate (\S+)/)[1];
			if ( (score>0 && playerColor === "w") || (score<0 && playerColor === "b") ) { score = -99; }
			else { score = 99; }
		}
		
		// transform centipawn score to scale between 0 an 100% (tscore) and degree (dscore, see css)
		var tscore = Math.round(50 + (score * 5));
		if (tscore<0)    { tscore=1;  }
		if (tscore>100)  { tscore=99; }
		if (score===-99) { tscore=0;  }
		if (score===99)  { tscore=100;}
		
	    var dscore = 360 * tscore/100;
		if(debug) { console.log("Current Score: "+score +" (cp), "+tscore+ "(%), ", +dscore+ "(deg)"); }
		var displayScore = document.getElementById('score');
	    if (displayScore) {
    		var ringColorA = "#fff";
    		var ringColorB = "#444";
	    	if (dscore>180) {
	    		dscore = dscore - 90;
	    	}
	    	else {
	    		dscore = dscore + 90;
	    		ringColorA = ringColorB;
	    	}
		    displayScore.setAttribute("style", "background-image: linear-gradient("+dscore+"deg, transparent 50%, "+ringColorA+" 50%), linear-gradient(90deg, "+ringColorB+" 50%, transparent 50%)");	    		
		}
		
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
	
	// little helper: sort  array by key
	function sortedKeys(keylist) {
		let r = Object.keys(keylist);
		r = r.sort();
		return r;
	}
	
	
	// provide select-box
	var select;
	function provide_select(selectlist, initial="", curmoves) {
		
		if (debug) { console.log(selectlist); }
		select = document.createElement("ul");
		select.classList.add('circle');
		
		var inner = document.createElement("span");
		inner.id = "centerselection";
		inner.classList.add('center');
		inner.innerHTML = initial;
		content.appendChild(inner);
				
		function selectThis(key){
			let inner_old = document.getElementById('centerselection');
			let inner_new = inner_old.cloneNode(true);
			content.replaceChild(inner_new, inner_old);

			if(key in otherEvents) {
				inner_new.innerHTML = selectlist[key].symbol;
			}
			else {
				// check if only one move left. Then display this 
				// instead of file/rank/piece combination!
				let search = initial + selectlist[key].symbol;
				let found  = find_moves(search, curmoves);
				if (Object.keys(found).length===1) {	
					inner_new.innerHTML = Object.keys(found)[0];
				}
				else {
					inner_new.innerHTML = search;
				}
				// none found at all? then the position of initial was wrong!
				if (Object.keys(found).length===0) {
					search = selectlist[key].symbol + initial;
					found  = find_moves(search, curmoves);
					if (Object.keys(found).length===1) {	
						inner_new.innerHTML = Object.keys(found)[0];
					}
					else {
						inner_new.innerHTML = search;
					}
				}
			}
			inner_new.addEventListener("click", selectlist[key].onclick);

			var currentSelection = document.getElementById('selectedSelection');
			if (currentSelection) {currentSelection.id = ""; }
			return "selectedSelection";
		}
	
		var n = Object.keys(selectlist).length; // number of elements 
		let i = 0;
		for(let key of sortedKeys(selectlist)) {
			let degree = Math.floor(360/n)*(i++); 
			degree = degree -90 + ((degree<90)?360:0);
			let circle_item = document.createElement("li");
			circle_item.classList.add('circle_item');
			if (/-O/.test(key)) {
				circle_item.classList.add('castling');
			}
			circle_item.innerHTML = selectlist[key].symbol;
			// should result in e.g.: .deg180 { transform: rotate(90deg)  translate(130px) rotate(-90deg); }
			circle_item.setAttribute("style", "transform: rotate("+degree+"deg) translate(130px) rotate(-"+degree+"deg);");
			circle_item.addEventListener("click", function() {
				this.id = selectThis(key);
			});
			select.appendChild(circle_item);
		}
		
		// check if bezel is beeing turned
		var listofSelections = select.getElementsByTagName("li");
		var index  = -1; // first index out of range, so turning clockwise will start at 1
		var lindex = listofSelections.length - 1; // last index
        
		// then tag the next/previous element if bezel is turned
		function turn_bezel(ev) {
			let dir = ev.detail.direction;
			if (dir) { dir = (dir==="CW")?1:-1;	} // Bezel is used
			else     { dir = ev.deltaY;			} // Mousewheel is used
			if (dir>0) { index = (index===lindex)?0:(index+1); } // clockwise
			if (dir<0) { index = (index<=0)? lindex:(index-1); } // counterclockwise
			let cur = sortedKeys(selectlist)[index];
	        listofSelections[index].id = selectThis(cur);
		};
		document.addEventListener('wheel',          turn_bezel);
		document.addEventListener('rotarydetent', turn_bezel);
		
		content.appendChild(select); 
	}
	
	// function to check if a given "move", i.e. file/rank(/piece) combination
	// is in the movelist. Returns all moves found.
	function find_moves(value, movelist) {
		let cm = {};
		let re = RegExp(value);		
		for (var m in movelist) {
			if (re.test(movelist[m].move)) {
				cm[m] = movelist[m];
			}
		}
		return cm;
	}

	// beside move selection, we might want to have some
	// other functions in the select menu. Those are defined here
	// by symbol to be shown and function to be triggered
	var otherEvents= {
		back: {  // go back and start selection from the beginning
			symbol: '<svg class="icon"><use xlink:href="css/cancel.svg#icon_cancel"></use></svg>',
			onclick: function() {
				turn_player();				
			},
		},
		info:{ // Show some infos
			symbol: '<svg class="icon"><use xlink:href="css/more.svg#icon_more"></use></svg>',
			onclick: function() {
						let infos = {
							pgn: { // show PGN
								symbol: '<svg class="icon"><use xlink:href="css/pgn.svg#icon_pgn"></use></svg>',
								onclick: function(){
								    showPGN(turn_player);
								}
							},
							board: { // show board
								symbol: '<svg class="icon"><use xlink:href="css/board.svg#icon_board"></use></svg>',
								onclick: function(){
									var message = document.createElement("span");
									message.innerHTML = renderFen(chess.fen());
									content.innerHTML = "";
									content.appendChild(message);
									// on click, go back to game
									message.addEventListener("click", function f(){
										turn_player();
									});									
								}
							},
						};					
						content.innerHTML = "";
						provide_select(infos);
			},
		},
	};
	
	
		
	// shows the current PGN-History of the game
	// argument is function to trigger if pgn is clicked
	function showPGN(fn) {
	    var message = document.createElement("span");
	    message.id = "pgn";
	    message.innerHTML = "PGN<br/>"+chess.pgn({ max_width: 5, newline_char: '<br />' });
	    content.innerHTML = "";
	    content.appendChild(message);
	    // TODO: Scroll using bezel

	    // on click, trigger event
	    message.addEventListener("click", fn);
	}
	
	
	// reduce the list of possible moves to only a list of
	// unique "key"s (e.g., unique files, ranks, or pieces)
	// and add a function which is executed on click
	function trimMoves(curmoves, key, fn) {
		let ret = {};
		for (var m in curmoves) {
			let r = curmoves[m][key];
			if (!(r in ret)) {
				ret[r] = { 
					symbol: curmoves[m][key],
					onclick: fn,
				};
			}
		}
		return ret;
	}

	// Player's turn
	// Move selection is done in three steps:
	// a) select file where to move
	// b) select rank where to move
	// c) select piece to move (optional, only if more than one can move to selection)
	
	var move; // variables to store target square (file/rank/piece)
	function turn_player() {

			content.innerHTML = "";
	
			// first split up each move into hash containing single elements
			var curmoves = {};
			chess.moves().forEach(function(m) {
				m = m.replace('+','');  // remove check mark '+'
				m = m.replace('#','');  // remove checkmate mark '#'
				var mm = {
					"file" : m.slice(-2)[0],
					"rank" : m.slice(-1),
					"square" : m.slice(-2),
					"piece": m.slice(0,-2)? m.slice(0,-2):"P", // if empty, it is a pawn move
				};
				// exception: castling
				if (m==="O-O")   { mm = { "file" : "O", "rank": "-O",   "square": m, "piece": "" };}
				if (m==="O-O-O") { mm = { "file" : "O", "rank": "-O-O", "square": m, "piece": "" };}				

				mm.move = mm.piece + mm.file + mm.rank; // so find_moves() will find something later

			          // exception: promotion
			          if(/=/.test(m)) {
				    m = m.slice(0,-1) +"Q"; // only promote to queen
				    var mm = {
				        "file" : m.slice(-4)[0],
				        "rank" : m.slice(-3)[0],
				        "square" : m.slice(-4,-2),
				        "piece": "=Q", // only promote to queen
				        "move": m,
				    };
				}

				curmoves[m] = mm;
			});

			// provide select-box for file == a)
			let files  = trimMoves(curmoves, "file", selectFile);
			files.info = otherEvents.info; // add info button
			provide_select(files,"",curmoves);
			
			function selectPiece(){
				// on change of the select: go!
				move = document.getElementById('centerselection').textContent;
				curmoves = find_moves(move, curmoves);
				content.innerHTML = "";
				play(Object.keys(curmoves)[0]);
				run();
			}

			function selectRank(){
				// on change of the select: store rank, proceed
				move = document.getElementById('centerselection').textContent;
				content.innerHTML = "";

				// now lets try if we are finished
				curmoves = find_moves(move, curmoves);

				// is this the only move? Then execute
				if (Object.keys(curmoves).length===1) {	
					play(Object.keys(curmoves)[0]);
					run();
				}
				// otherwise, we need to be some more specific
				else {
					let pieces = trimMoves(curmoves, "piece", selectPiece);
					pieces.back = otherEvents.back; // add back button
					provide_select(pieces,move,curmoves);
				}
			}	
			
			function selectFile() {
				// on change of the select: store file, proceed
				move = document.getElementById('centerselection').textContent;
				content.innerHTML = "";
				
				// third, provide select-box for rank == b), if necessary
				curmoves = find_moves(move, curmoves);
				
				// is this the only move? Then execute
				if (Object.keys(curmoves).length===1) {	
					play(Object.keys(curmoves)[0]);
					run();
				}
				else {				
					let ranks = trimMoves(curmoves, "rank", selectRank);
					ranks.back = otherEvents.back; // add back button
					provide_select(ranks, move, curmoves);
				}
			}			
	}
				

	// Engine's turn
	function turn_engine() {
		// send the current situation to the engine (evaluate this!)
		stockfish.postMessage("position fen "+ chess.fen());
		stockfish.postMessage("go depth 10");
		stockfish.postMessage("isready");

		// providing feedback is handled in stockfish.onmessage(...)
		// on click: remove feedback element, new turn
		var enginemove = document.createElement("span");
		enginemove.id = "enginemove";
		enginemove.classList.add('center');

		var score = document.createElement("div");
		score.id = "score";

		var innerscore = document.createElement("span");
		innerscore.id = "innerscore";

		score.appendChild(innerscore);
		content.appendChild(score);
		content.appendChild(enginemove);

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
			log = log + "<br/>" + "PGN: " + chess.pgn(); 
			log = log + "<br/>" + "FEN: " + chess.fen(); 
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
		// save
		save("pgn", chess.pgn());
		fill_debug(move);
	}

	// play one turn
	function run() {
		
		// only proceed if it is not game-over yet!
		if(chess.game_over()) {
		
			var message = document.createElement("span");
			content.appendChild(message);
                              message.classList.add('center');
			message.id = "message";
			// on click, review the complete game
			message.addEventListener("click", function f(){
			    showPGN();// do nothing, game is over
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
			
		}
	}

	
	// Begin the game. Either choose white or black, 
	// or load a previously interrupted game.
	var playerColor = "w"; //initialize playerColor with white
	function start() {

		var s = document.getElementById('startmenu');

		// little helper: everything is set, now begin with the game
		function begin(pc, lvl){
			playerColor = pc;  // set playerColor			
			save("playerColor", playerColor);
			
			s.remove(); // remove menue

			// set skill level
			function selectSkill(){
				let skill = lvl;
				let container = document.getElementById('centerselection');
				if (container) {
					skill = container.textContent;
					content.innerHTML = "";
				}
				stockfish.postMessage("setoption name Skill Level value "+ skill);
				save("level", skill);
				fill_debug(""); // debugging
				run(); // start the game				
			}

			
			// if level is set (because game was loaded)
			if (lvl) {
				selectSkill();
			}
			else {
			/*
			set difficulty
			found those elo ratings on the internet, no clue if this maps right. It is some rough idea though...
				0: 1100
				1: 1165
				2: 1230
				3: 1295
				4: 1360
				5: 1425
				6: 1490
				7: 1555
				8: 1620
				9: 1685
				10:1750
				11:1832
				12:1914
				13:1996
				14:2078
				15:2160
				16:2242
				17:2324
				18:2406
				19:2488
				20:2570
			*/
				let skills = {};
				for (var i = 1; i <=8; i++) {
					skills[i] = { 
						symbol: i,
						onclick: selectSkill,
					};
				}

				provide_select(skills);			
			}
		}
			
		// Box for Load game
		var l = document.getElementById('lowermenuentry');
		l.classList.add("chooseLoad");
		l.innerHTML = "Load";
		l.addEventListener("click", load_game);
		function load_game(){
			// Load previously saved game
			var pgn = load("pgn");
			var plc = load("playerColor");
			var lvl = load("level");
						
			// Tests
			//plc = "w"; var lvl = "1";
			// castling
			//pgn = "1. e4 e6 2. Nf3 d6 3. Bb5+ c6 4. Qe2 f6 5. b4 cxb5 6. Ba3 a6 7. Nc3 Ne7";
			// en passant
			//pgn = "1. e4 e6 2. e5 d5";
			// next move check, then checkmate
			//pgn = "1. e4 e6 2. Nf3 d6 3. Bb5+ c6 4. Qe2 f6 5. b4 cxb5 6. Ba3 a6 7. Nc3 Ne7 8. Kf1 Nbc6 9. Qxb5 axb5 10. Nd5 exd5 11. Ne5 dxe5 12. Rb1 Rxa3 13. Kg1 Rb3 14. Re1 d4 15. Re2";
			// promotion
			//pgn = "1. b4 b5 2. a4 a5 3. axb5 Nc6 4. bxa5 Ne5 5. a6 Rb8 6. a7 Rb6 7. c3 Rh6 8. b6 Rg6 9. b7 Ng4";
			//only 1 move in file b
			//pgn="1. b4 c5 2. bxc5 d6";
			// only 1 square in e, but multiple pieces
			//pgn="1. e4 d5 2. exd5 Qxd5";
			chess.load_pgn(pgn, {sloppy:true}); begin(plc,lvl);
		}
		
		// Box for newGame
		var n = document.getElementById('uppermenuentry');
		n.classList.add("chooseNG");
		n.innerHTML = "New";
		n.addEventListener("click", function (){
			
			// remove event-listener of load game box,
			// otherwise we have two events fired!
			l.removeEventListener("click", load_game);

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
	
	// translate the fen-string to a html-table containing the unicode-chess-symbols
	function renderFen(fentxt) {
		fentxt = fentxt.replace(/ .*/g, '');
		fentxt = fentxt.replace(/r/g, 'x'); // Convert black rooks to 'x' to avoid mixup with <tr></tr> tags
		fentxt = fentxt.replace(/\//g, '</tr><tr>');
		fentxt = fentxt.replace(/1/g, '<td></td>');
		fentxt = fentxt.replace(/2/g, '<td></td><td></td>');
		fentxt = fentxt.replace(/3/g, '<td></td><td></td><td></td>');
		fentxt = fentxt.replace(/4/g, '<td></td><td></td><td></td><td></td>');
		fentxt = fentxt.replace(/5/g, '<td></td><td></td><td></td><td></td><td></td>');
		fentxt = fentxt.replace(/6/g, '<td></td><td></td><td></td><td></td><td></td><td></td>');
		fentxt = fentxt.replace(/7/g, '<td></td><td></td><td></td><td></td><td></td><td></td><td></td>');
		fentxt = fentxt.replace(/8/g, '<td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>');
		fentxt = fentxt.replace(/K/g, '<td>&#9812;</td>');
		fentxt = fentxt.replace(/Q/g, '<td>&#9813;</td>');
		fentxt = fentxt.replace(/R/g, '<td>&#9814;</td>');
		fentxt = fentxt.replace(/B/g, '<td>&#9815;</td>');
		fentxt = fentxt.replace(/N/g, '<td>&#9816;</td>');
		fentxt = fentxt.replace(/P/g, '<td>&#9817;</td>');
		fentxt = fentxt.replace(/k/g, '<td>&#9818;</td>');
		fentxt = fentxt.replace(/q/g, '<td>&#9819;</td>');
		fentxt = fentxt.replace(/x/g, '<td>&#9820;</td>');
		fentxt = fentxt.replace(/b/g, '<td>&#9821;</td>');
		fentxt = fentxt.replace(/n/g, '<td>&#9822;</td>');
		fentxt = fentxt.replace(/p/g, '<td>&#9823;</td>');
		return '<table id="board" cellspacing="0" cellpadding="0"><tr>' + fentxt + '</tr></table>';
	}

	// initalize/setup/start with the game
	start();
