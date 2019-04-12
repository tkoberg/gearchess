
// set to true for debugging
var debug = 0;

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
	
	// this is the interact/output element
	var content = document.getElementById('content');
	if (debug) {
		content.style.border = '2px solid red'; 
	}

	// for debugging
	var debugDiv = document.getElementById('debug');

	// during player's turn, save all selection results in this variable
	// initalize player's color to white and engine skill level to 1
	var data = {file:"", rank:"", piece:"", color:"w", skill:"1"};
	
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
			if (data.color === "w") { 
				score = -score;
			}
		}
		// ... or mate
		if (/mate/.test(event.data)) {
			score = event.data.match(/mate (\S+)/)[1];
			if ( (score>0 && data.color === "w") || (score<0 && data.color === "b") ) { score = -99; }
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
			enginemove.innerHTML = move;
			// are we in check?
			if(chess.in_check()) {
				content.classList.add('inCheck');
			}
			else {
				content.classList.remove('inCheck');
			}
	}
	};
	
	// little helper: sort array by key
	function sortedKeys(keylist) {
		let r = Object.keys(keylist);
		r = r.sort();
		// always sort "back" at ...
		['back'].forEach(function (bg) {
			let i = r.indexOf(bg);
			if (i>-1) {
				r.splice(i, 1);
				//r.unshift(bg); // ... the beginning
				r.push(bg); // ... the end
			}
		});
		return r;
	}

	// cleanup display
	function clean() {
		document.removeEventListener('wheel', turn_bezel);
		document.removeEventListener('rotarydetent', turn_bezel);
		content.innerHTML = "";
	}

	// provide dichotome menu
	function provide_menu(optionA, optionB) {
		clean();
		var m = document.createElement("ul");
		var a = document.createElement("li");
		var b = document.createElement("li");
		
		m.classList.add("startmenu");
		a.classList.add("menuentry");
		b.classList.add("menuentry");
		a.classList.add("upperMenu");
		b.classList.add("lowerMenu");

		a.innerHTML = optionA.symbol;
		b.innerHTML = optionB.symbol;

		a.addEventListener("click", optionA.onclick);
		b.addEventListener("click", optionB.onclick);

		m.appendChild(a);
		m.appendChild(b);
		content.appendChild(m);
	}
	
	// provide select-box
	// argument 'setkey' assigns the result
	function provide_select(setkey) {
		
		clean();
		if (debug) { 
			console.log("selection:"); console.log(selection);
			console.log("data:"); console.log(data);
		}
		var ul = document.createElement("ul");
		ul.classList.add('circle');

		// dummy which will be replaced later
		var innerStub = document.createElement("span");
		innerStub.id = "centerselection";
		innerStub.classList.add('center');

		var n = Object.keys(selection).length; // number of elements 
		sortedKeys(selection).forEach(function (key, i) {
			let degree = Math.floor(360/10)*(i); 
			degree = degree -90 + ((degree<90)?360:0);

			let circle_item = document.createElement("li");
			circle_item.classList.add('circle_item');
			if(key in otherEvents) {
				circle_item.classList.add(key);
			}
			else {
				circle_item.classList.add(setkey);
			}
			if (/-O/.test(key)) {
				circle_item.classList.add('castling');
			}
			if (key.length>=2) {
				circle_item.classList.add('circle_item_wide');
			}


			
			circle_item.innerHTML = selection[key].symbol;
			circle_item.setAttribute("style", "--d: "+degree+"deg");
			circle_item.addEventListener("click", function() { tagSelected(this); });
			ul.appendChild(circle_item);
		});
		        
		// tag the next/previous element if bezel is turned
		document.addEventListener('wheel', turn_bezel);
		document.addEventListener('rotarydetent', turn_bezel);
		
		content.appendChild(ul); 
		content.appendChild(innerStub); 
		tagSelected(document.getElementsByTagName("li")[0]);
	}

	// this happens when the bezel/mouse-wheel is turned: 
	// next/previous element in list is tagged
	function turn_bezel(ev) {
		
		let dir = ev.detail.direction;
		if (dir) { dir = (dir==="CW")?1:-1;	} // Bezel is used
		else     { dir = ev.deltaY;			} // Mousewheel is used

		// get a list of all items and check which one is
		// currently selected (if none, select the first)
		let list = document.getElementsByTagName("li");
		var ci = -1;
		for (var i = 0; i < list.length; i++) {
			 if(list[i].id==="selectedSelection"){
				ci = i;
			}
		}
		
		// change to which direction?
		if (dir>0) { ci = (ci===(list.length-1))?0:(ci+1); } // clockwise
		if (dir<0) { ci = (ci<=0)? (list.length-1):(ci-1); } // counterclockwise
						
		// tag the selected element
		tagSelected(list[ci]);
	}
	
	// tag (i.e. focus on) the currently selected list element
	function tagSelected(el) {
		
		// untag the currently selected element
		var currentSelection = document.getElementById('selectedSelection');
		if (currentSelection) {currentSelection.id = ""; }

		el.id="selectedSelection";
				
		// the key is usually the content, but in case of otherEvents,
		// it is a svg! So we take the array-key instead
		var key = el.innerHTML;
		let isIcon = false;
		for (var k in otherEvents) {
			if (el.classList.contains(k)) {
				key = k;
				isIcon = true;
			}
		}

		// clone the inner element (we have to overwrite it!)
		let inner_old = document.getElementById('centerselection');
		let inner     = inner_old.cloneNode(true);
		content.replaceChild(inner, inner_old);
		
		// add the provided event listener
		inner.addEventListener("click", selection[key].onclick);
				
		// try to make the inner text more informational
		let innerText = key;
		if(isIcon) {
			innerText = otherEvents[key].symbol;
		}
		else {
			if (el.classList.contains("file"))  { data.file  = key; }
			if (el.classList.contains("rank"))  { data.rank  = key; }
			if (el.classList.contains("piece")) { data.piece = key; }
			if (el.classList.contains("skill")) { data.skill = key; }
			// check if only one move left. Then display this 
			// instead of file/rank/piece combination!
			let found  = find_moves(curmoves);
			if (Object.keys(found).length===1) { 
				innerText = Object.keys(found)[0];	
			}
			else if (Object.keys(found).length>1) {
				innerText = data.piece + data.file + data.rank;
			}
		}
		inner.innerHTML = innerText;
		
		// try to shrink the scale (display size) of the element to its extent (length of string)
		let innerScale = 3.0;
		switch (innerText.length) {
			case 2: innerScale = 2.5; break;
			case 3: innerScale = 1.8; break;
			case 4: innerScale = 1.5; break;
			case 5: innerScale = 1.2; break;
			case 6: innerScale = 1.0; break;
		}
		inner.setAttribute("style","--scale:"+ innerScale);
		
		content.appendChild(inner);
	}
	
	// function to check if a given "move", i.e. file/rank(/piece) combination
	// is in the movelist. Returns all moves found.
	function find_moves(movelist) {
		let cm = JSON.parse(JSON.stringify( movelist )); // deep copy of movelist
		for (var i in cm) {
			if (
				(data.file!==""  && data.file!==cm[i].file) ||
				(data.rank!==""  && data.rank!==cm[i].rank) ||
				(data.piece!=="" && data.piece!==cm[i].piece)
			){ 
				delete cm[i]; 
			}
		}
		return cm;
	}

	// little wrapper to ease creation of icons
	function iconize(icon) {
		let s = document.createElement("svg");
		s.classList.add('icon');
		s.classList.add(icon);
		s.innerHTML = '<use xlink:href="css/'+icon+'.svg#icon_'+icon+'"></use>';
		return s.outerHTML;
	}

	// provide some options to toggle on/off
	var options = {
		hint: {  // show pondering as a hint
			note:   'show hint',
			set:    false,
			fixed: true,
		},
		score: {  // show current imbalance of game
			note:   'show score',
			set:    true,
			fixed: false,
		},
		queenpromote: {  // always promote to queen
			note:   'always promote to queen',
			set:    true,
			fixed: true,
		},
		alwaysShowBoard: {  // always show the board after the engine moved
			note:   'show board after turn',
			set:   false,
			fixed: false,
		},
		
	};
		
	// beside move selection, we might want to have some
	// other functions in the select menu. Those are defined here
	// by symbol to be shown and function to be triggered
	var otherEvents= {
		back: {  // go back and start selection from the beginning
			symbol: iconize('cancel'),
			onclick: function() {
				turn_player();				
			},
		},
		undo: {  // undo the last move
			symbol: iconize('undo'),
			onclick: function(){ 
				provide_menu(
					{   symbol: 'undo', // execute undo
					    onclick: function() {
						chess.undo(); // undo engines last move
						data.lastmove = "";
						chess.undo(); // undo players last move
						showBoard(turn_player);
					},
					},
					{ symbol: 'do not', onclick: function() {turn_player} }// step back from the undo
				)
			}
		},
		info:{ // Show some infos
			symbol: iconize('more'),
			onclick: function() {
				content.innerHTML = "";
				selection = {back: otherEvents.back, undo: otherEvents.undo, pgn: otherEvents.pgn, board: otherEvents.board, highscore: otherEvents.highscore, options: otherEvents.options};
				provide_select("info");
			},
		},
		pgn: { // show PGN
			symbol: iconize('pgn'),
			onclick: function(){
				showPGN(turn_player);
			}
		},
		board: { // show board
			symbol: iconize('board'),
			onclick: function(){
				showBoard(turn_player);
			}
		},
		highscore: {  // show wins and losses
			symbol: iconize('highscore'),
			onclick: function() {
				let message = document.createElement("span");
				message.id = "highscore";
				let m = "Highscore<br/>";
				let l = load('lost_games') || 0;
				let d = load('draw_games') || 0;
				let w = load('won_games')  || 0;
				//let p = Math.round((w/(l+d+w))*100);
				let p = Math.round(100*w/(1*l+1*d+1*w));
				m = m +"Lost: "+ l + "<br/>";
				m = m +"Draw: "+ d + "<br/>";
				m = m +"Won: " + w + "<br/>";
				m = m +"= "+ p + "%<br/>";
				message.innerHTML = m;
				content.innerHTML = "";
				content.appendChild(message);
				// on click, back to main menu
				message.addEventListener("click", turn_player);
			},
		},
		options:{ // Show some infos
			symbol: iconize('options'),
			onclick: function() {
				let opt = document.createElement("ul");
				opt.id = "menu";
				opt.classList.add('settingsList');
		
				Object.keys(options).forEach(function (key, i) {
					let state = (options[key].set)? "on": "off"; // current state: on or off?

					let o  = document.createElement("li");

					let ot = document.createElement("span");
					ot.classList.add('settingsText');
					ot.innerHTML = options[key].note;

					let oo = document.createElement("span");
					oo.innerHTML = iconize('toggle_'+state);
					if (!options[key].fixed) {
						o.addEventListener("click", function() {
							options[key].set = !options[key].set;
							state = (options[key].set)? "on": "off";
							oo.innerHTML = iconize('toggle_'+state);
						});
					}
					o.appendChild(ot);
					o.appendChild(oo);
					opt.appendChild(o);
				});
		
				let back = document.createElement("li");
				back.addEventListener("click", turn_player);
				//back.addEventListener("click", otherEvents.info.onclick); // or just go back to info menu?
				back.innerHTML = otherEvents.back.symbol;
				opt.appendChild(back);

				content.innerHTML = "";
				content.appendChild(opt);
			},
		},
		newGame: {
			symbol: "New",
			onclick: function(){ provide_menu(otherEvents.chooseWhite, otherEvents.chooseBlack); }
		},
		loadGame: { // Load previously saved game
			symbol: "Load",
			onclick: function(){
				data.color = load("playerColor");
				data.skill = load("skill");
				let pgn = load("pgn");
				chess.load_pgn(pgn, {sloppy:true});
						
				// Tests
				var fen;
				//fen="4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1";      // castling
				//fen="4k3/8/8/3Pp3/8/8/8/4K3 w - e6 0 1";     // en passant
				//fen="4k3/8/8/8/1r6/r7/7K/8 b - - 0 1";       // next move check, then checkmate
				//fen="3n3k/P1P5/8/8/8/8/8/7K w - - 0 1";      // promotion
				//fen="K2n3k/2P1P3/8/8/8/8/8/8 w - - 0 1";     // 2 pawns attack same square&promote (d8)
				//fen="6rk/8/8/8/8/8/2N5/K7 w - - 0 1";        // only 1 move in file d
				//fen="k7/8/B7/8/8/R2p3R/2PKP3/2NQN2K w - - 0 1";// only 1 square in d, but multiple pieces
				//chess.load(fen); data.color = "w";
				
				clean();
				fill_debug(""); // debugging
				run(); // start the game
			}
		},
		chooseWhite: {
			symbol: "White",
			onclick: function() { setColor("w"); }
		},
		chooseBlack: {
			symbol: "Black",
			onclick: function() { setColor("b"); }
		},

	};
	
	function setColor(color) {
		data.color = color;
		save("playerColor", data.color);
		clean();
		/* 
		set difficulty/skill of engine
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
		selection = {};
		for (var i = 1; i <=9; i++) {
			selection[i] = { 
				symbol: i,
				onclick: function() {
					if (debug) { console.log("set skill to: "+data.skill); }
					stockfish.postMessage("setoption name Skill Level value "+ data.skill);
					save("skill", data.skill);
					clean();
					fill_debug(""); // debugging
					run(); // start the game
				},
			};
		}
		provide_select("skill");			
	}
	
		
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

	// shows the current Board
	// argument is function to trigger if clicked
	function showBoard(fn) {
		clean();
		let b = buildBoard(chess.fen(), data.lastmove);
		b.classList.add('singleBoard');					
		b.addEventListener("click", fn);
		content.appendChild(b);			
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
	var curmoves = {};
	var selection;
	function turn_player() {

			clean();
			data = {file:"", rank:"", piece:"", color:data.color, skill:data.skill, lastmove: data.lastmove};
			
			// first split up each move into hash containing single elements
			curmoves = {};
			chess.moves().forEach(function(m) {
				m = m.replace('+','');  // remove check mark '+'
				m = m.replace('#','');  // remove checkmate mark '#'
				var mm = {
					"file" : m.slice(-2)[0],
					"rank" : m.slice(-1),
					"square" : m.slice(-2),
					"piece": m[0] + ((m.length>3 && m[1]!=="x") ? m[1] : ""), // second letter might also be necessary to identify piece
					"move": m
				};
				// exception: castling
				if (m==="O-O")   { mm = { "file" : "O", "rank": "-O",   "square": m, "piece": "" };}
				if (m==="O-O-O") { mm = { "file" : "O", "rank": "-O-O", "square": m, "piece": "" };}				

				// exception: promotion
				if(/=/.test(m)) {
					m = m.slice(0,-1)+"Q"; // promote to queen only
				    mm = {
				        "file" : m.slice(-4)[0],
				        "rank" : m.slice(-3)[0],
				        "square" : m.slice(-4,-2),
				        "piece": m[0],
				        "promote": m.slice(-2), // promote to ... (not implemented yet)
				        "move": m,
				    };
				}

				curmoves[m] = mm;
			});

			// provide select-box for file == a)
			selection  = trimMoves(curmoves, "file", selectFile);
			selection.info = otherEvents.info; // add info button
			provide_select("file");
			
			function selectPiece(){
				// on change of the select: go!
				curmoves = find_moves(curmoves);
				content.innerHTML = "";
				play(Object.keys(curmoves)[0]);
				run();
			}

			function selectRank(){
				// on change of the select: store rank, proceed

				// now lets try if we are finished
				curmoves = find_moves(curmoves);
				// is this the only move? Then execute
				content.innerHTML = "";
				if (Object.keys(curmoves).length===1) {	
					play(Object.keys(curmoves)[0]);
					run();
				}
				// otherwise, we need to be some more specific
				else {
					selection = trimMoves(curmoves, "piece", selectPiece);
					selection.back = otherEvents.back; // add back button
					provide_select("piece");
				}
			}	
			
			function selectFile() {
				// on change of the select: store file, proceed
				content.innerHTML = "";

				// provide select-box for rank == b), if necessary
				curmoves = find_moves(curmoves);
				// is this the only move? Then execute
				if (Object.keys(curmoves).length===1) {	
					play(Object.keys(curmoves)[0]);
					run();
				}
				else {	
					selection = trimMoves(curmoves, "rank", selectRank);

					// maybe not the only move, but is there only one rank? 
					// Then skip rank selection and go directly to piece selection
					if (Object.keys(selection).length===1) {
						curmoves = find_moves(curmoves);

						selection = trimMoves(curmoves, "piece", selectPiece);
						selection.back = otherEvents.back; // add back button
						provide_select("piece");
					}
					else {						
						selection.back = otherEvents.back; // add back button
						curmoves = find_moves(curmoves);
						provide_select("rank");
					}
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
		if (options.score.set) {
			content.appendChild(score);
		}
		content.appendChild(enginemove);
		
		enginemove.addEventListener("click", function f(){
			enginemove.removeEventListener("click",f);
			data.lastmove = enginemove.innerHTML;
			if (options.alwaysShowBoard.set) {
				showBoard(run);
			}
			else {
				run();
			}
		});

	}

	// Print some debugging
	function fill_debug(move) {
		if (debug) {
			debugDiv.innerHTML="";
			
			// board
			let b = buildBoard(chess.fen(), move);
			
			// some messages
			let l = document.createElement("div"); 
			var log = "played [" + move + "], ";
			log = log + "   FEN: [" + chess.fen() + "]";
			if (chess.in_check()) {
				log = log + " Check!"; 
			}
			if (chess.in_checkmate()) {
				log = log + " Checkmate!"; 
			}
			if (chess.in_stalemate()) {
				log = log  + " Stalemate!"; 
			}
			l.innerHTML = log;
			
			// PGN
			let p = document.createElement("div");
			p.innerHTML = chess.pgn(); 
			
			b.classList.add('debugItem');
			p.classList.add('debugItem');
			
			debugDiv.appendChild(l);
			debugDiv.appendChild(b);
			debugDiv.appendChild(p);
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

		// is it the player's turn?
		let playersTurn = (chess.turn() === data.color);
	
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
				if(playersTurn) { let g = load('lost_games') || 0; save('lost_games',++g); }
				else            { let g = load('won_games')  || 0; save('won_games', ++g); }
			}

			// 2) stalemate?
			if(chess.in_stalemate()) {
				message.innerHTML = "Stale-mate!";
				if(playersTurn) { let g = load('lost_games') || 0; save('lost_games',++g); }
				else            { let g = load('won_games')  || 0; save('won_games', ++g); }
			}

			// 3) draw?
			if(chess.in_draw() || chess.in_threefold_repetition()) {
				message.innerHTML = "Draw!";
				let g = load('draw_games') || 0; save('draw_games', ++g);
			}		
		}
		else { // not yet game-over
			
			// play the side on turn
			if (playersTurn) {
				turn_player();
			}
			else {
				turn_engine();
			}		
			
		}
	}
	
	// translate the fen-string to a html-table containing the unicode-chess-symbols.
	// also, highlight the last move on the board (lastmove should be something like "d7d6")
	function buildBoard(fentxt, lastmove) {
		// construct table out of fen
		fentxt = fentxt.replace(/ .*/g, '');
		fentxt = fentxt.replace(/r/g, 'x'); // Convert black rooks to 'x' to avoid mixup with <tr></tr> tags
		fentxt = fentxt.replace(/\//g, '</tr><tr><td>X</td>'); // 'X' will be replaced with ranknumber later
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
		fentxt = '<td>X</td>' + fentxt + '</tr><tr><td></td>';
		for (var i = 0; i < 8; i++) {
			fentxt = fentxt.replace(/X/, (8-i));
			fentxt = fentxt + '<td>'+(i+10).toString(36)+'</td>';
		}
		let b = document.createElement("table");
		b.id = "board";
		b.cellSpacing = "0";
		b.cellPadding = "0";
		b.innerHTML = '<tr>' + fentxt + '</tr>';
		
		// add highlighting of last move
		if(lastmove && lastmove.length===4){ 
			let alph = ["a", "b", "c", "d", "e", "f", "g", "h"];
			let f1 = alph.indexOf(lastmove[0])+1;
			let f2 = 8-lastmove[1];
			let t1 = alph.indexOf(lastmove[2])+1;
			let t2 = 8-lastmove[3];
			if (!(isNaN(f1) || isNaN(f2) || isNaN(t1) || isNaN(t2))) {
				let tdf = b.getElementsByTagName('tr')[f2].getElementsByTagName('td')[f1];
				let tdt = b.getElementsByTagName('tr')[t2].getElementsByTagName('td')[t1];
				tdf.classList.add('highlightedSquare');
				tdt.classList.add('highlightedSquare');
			}
		}
		
		return b;
	}
	
	// initalize/setup/start with the game
	provide_menu(otherEvents.newGame, otherEvents.loadGame);