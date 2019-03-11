
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
	if (debug) {
		content.style.border = '2px solid red'; 
	}

	// Chess interaction functions (chess.js); this comes with no engine!
	var chess = new Chess();	
	
	// initalize the engine (stockfish.js)
	var stockfish = new Worker('js/stockfish/src/stockfish.js');
	stockfish.postMessage("ucinewgame");
	
	// read the response of the engine and ...
	var score=0;
	stockfish.onmessage = function(event) { 
		if(debug) { console.log(event.data) };
		
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
		if (tscore<0)    tscore=1;
		if (tscore>100)  tscore=99;
		if (score===-99) tscore=0;
		if (score===99)  tscore=100;

	        var dscore = 90 + 3.6*(tscore - (tscore>50?50:0));
		if(debug) console.log("Current Score: "+score +" (cp), "+tscore+ "(%), ", +dscore+ "(deg)");
		var displayScore = document.getElementById('score');
	        if (displayScore) {
		    var nonscoreColor = "#444";
		    var scoreColor = (tscore>50)? "#fff":nonscoreColor;
		    displayScore.setAttribute("style", "background-image: linear-gradient("+dscore+"deg, transparent 50%, "+scoreColor+" 50%), linear-gradient(90deg, "+nonscoreColor+" 50%, transparent 50%)");
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
	
	// little helper: sort  lexicographically, unless castling/promotion (should come last)
	function sort_select (a,b) {
		var r = a.toLowerCase().localeCompare(b.toLowerCase()); 
		if (a==="=") r=1;
		if (a==="O") r=1;
		if (b==="=") r=-1;
		if (b==="O") r=-1;
		return r;
	}
	
	// provide select-box
	var select;
	function provide_select(selectlist, onchangefunction) {
		select = document.createElement("ul");
		select.classList.add('circle');
		var n = selectlist.length >8 ? 8 : selectlist.length; // use a maximum of eight elements on circle
		for(var index in selectlist.sort(sort_select)) {
			var degree = Math.floor(360/(n*45))*45*index; 
			var circle_item = document.createElement("li");
			circle_item.classList.add('circle_item');
			circle_item.innerHTML = selectlist[index];
			// if more than eight (==nine!), place in the middle
			if (index>=n) {
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
	
	// function to check if a given "move", i.e. file/rank(/piece) combination
	// is in the movelist. Returns all moves found.
	function find_moves(value, key, movelist) {
		var curmoves = {};
		for (m in movelist) {
			if (movelist[m][key] == value) {
				curmoves[m] = movelist[m];
			}
		}
		return curmoves;
	}
	
	// little helper to print the current already selected elements inside the circle
	function fill_center(txt) {
		centerselection = document.createElement("span");
		centerselection.innerHTML = txt;
		centerselection.classList.add('centerselection');
		centerselection.addEventListener("click", function () {
			content.innerHTML = "";
			turn_player(); // on click, revert selection and start again
		});
		return centerselection;
	}
	
	// Player's turn
	// Move selection is done in three steps:
	// a) select file where to move
	// b) select rank where to move
	// c) select piece to move (optional, only if more than one can move to selection)
	
	var moveF, moveR, moveP; // variables to store target square (file/rank/piece)
	function turn_player() {

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
				if (m==="O-O")   { mm = { "file" : "O", "rank": "-O",   "square": m, "piece": "" }};
				if (m==="O-O-O") { mm = { "file" : "O", "rank": "-O-O", "square": m, "piece": "" }};				
				
				mm["move"] = mm["piece"]+mm["file"]+mm["rank"]; // so find_moves() will find something later
				curmoves[m] = mm;
			});

			// provide select-box for file == a)
			var files = [];
			for (m in curmoves) {
				var f = curmoves[m]["file"];
				if (!files.includes(f)) {
					files.push(f);
				}
			}
			
			provide_select(files, function() {
				// on change of the select: store file, proceed
				moveF = this.textContent;
				select.remove();
			
				// third, provide select-box for rank == b), if necessary
				curmoves = find_moves(moveF, "file", curmoves);
				
				// is this the only move? Then execute
				if (Object.keys(curmoves).length===1) {	
					play(Object.keys(curmoves)[0]);
					run();
				}
				else {				
					var ranks = [];
					for (m in curmoves) {
						var r = curmoves[m]["rank"];
						if (!ranks.includes(r)) {
							ranks.push(r);
						}
					}
					
					provide_select(ranks, function(){
						// on change of the select: store rank, proceed
						moveR = this.textContent;
						select.remove();

						// now lets try if we are finished
						curmoves = find_moves(moveF+moveR,"square", curmoves);

						// is this the only move? Then execute
						if (Object.keys(curmoves).length===1) {	
							play(Object.keys(curmoves)[0]);
							run();
						}
						// otherwise, we need to be some more specific
						else {
							var pieces = [];
							for (m in curmoves) {
								var p = curmoves[m]["piece"];
								if (!pieces.includes(p)) {
									pieces.push(p);
								}
							}

							provide_select(pieces, function(){
								// on change of the select: go!
								moveP = this.textContent;
								curmoves = find_moves(moveP+moveF+moveR,"move", curmoves);
								select.remove();
								play(Object.keys(curmoves)[0]);
								run();
							});
							
							select.appendChild(fill_center(moveF+moveR)); 
						}
					});
					
					select.appendChild(fill_center(moveF)); 
				}
			});				
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

		var score = document.createElement("div");
		score.id = "score";

		score.appendChild(enginemove);
		content.appendChild(score);

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
			/*
			set difficulty
			found those elo ratings on the internet, no clue if this maps right. It is some rough idea though...
			TODO: save and load difficulty for resume game
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
			provide_select(["1","2","3","4","5","6","7","8"], function(){
				stockfish.postMessage("setoption name Skill Level value "+ this.textContent);
				select.remove();
				fill_debug(""); // debugging
				run(); // start the game				
			});
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
			
			//chess.load_pgn("1. e4 d6 2. d4 Nf6 3. Nc3 e5 4. Nf3 Nbd7 5. a4 a6 6. Bc4 Nb6 7. Bxf7+ Kxf7 8. dxe5 Ne8 9. a5 Be7 10. axb6 dxe5 11. Nxe5+ Kg8 12. O-O Bf6 13. Ng4 Bg5 14. Qe2 Bxc1 15. Raxc1 Qd7 16. Ne3 Qf7 17. f4 h6 18. f5 cxb6 19. e5 Qf8 20. Rcd1 Qb4 21. Ned5 Qc5+ 22. Kh1 Nc7 23. Qh5 Bd7 24. Nf6+ Kf8 25. Nxd7+ Kg8 26. f6 Qxc3 27. fxg7 Qc4 28. Qg6 Qxf1+ 29. Rxf1 Nd5 30. Rf8+ Rxf8", {sloppy:true});begin("w");
			//chess.load_pgn("1. e4 d6 2. d4 Nf6 3. Nc3 e5 4. Nf3 Nbd7 5. a4 a6 6. Bc4 Nb6 7. Bxf7+ Kxf7 8. dxe5 Ne8 9. a5 Be7 10. axb6 dxe5 11. Nxe5+ Kg8 12. O-O Bf6 13. Ng4 Bg5 14. Qe2 Bxc1 15. Raxc1 Qd7 16. Ne3 Qf7 17. f4 h6 18. f5 cxb6 19. e5 Qf8 20. Rcd1 Qb4 21. Ned5 Qc5+ 22. Kh1 Nc7 23. Qh5 Bd7 24. Nf6+ Kf8 25. Nxd7+ Kg8 26. f6 Qxc3 27. fxg7 Qc4 28. Qg6 Qxf1+ 29. Rxf1 Nd5 30. Rf8+ Rxf8 31. gxh8=Q+ Kxh8 32. Nxf8 Nf6 33. exf6 a5", {sloppy:true});begin("w");
			// Test promotion
			//chess.load_pgn("1. b4 b5 2. a4 a5 3. axb5 Nc6 4. bxa5 Ne5 5. a6 Rb8 6. a7 Rb6 7. c3 Rh6 8. b6 Rg6 9. b7 Ng4", {sloppy:true});begin("w");
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
