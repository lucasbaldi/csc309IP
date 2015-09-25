var express = require('express');
var app = express();

var pg = require('pg');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var fs = require('fs');
var sanitizer = require('sanitizer');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(cookieParser());
app.use(express.static(__dirname + '/public'));
app.use(session({secret: '123', resave: 'false', saveUninitialized: 'false'}));
app.use(morgan('dev'));

app.set('views', __dirname + '/public/views');
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

var conString ="postgres://postgres@localhost:5432/postgres";

app.get('/', function (req, res){
	if (req.session.user){
		res.redirect('posts.html');
	}
	res.render('start.html');
	res.end();
});

app.get('/register.html', function(req, res){
	res.render('register.html');
});

app.post('/newUser', function(req, res){
	var newEmail = req.body.email;
	var newPass = req.body.password;
	var newName = req.body.name;
	console.log('name= '+newName+ ' email= '+newEmail+' pw = '+ newPass)
	var result = [];
	
	var client = new pg.Client(conString);
	client.connect(function(err,done){
		if(err){res.send('sorry, connection error '+err);}
		var query = client.query('Insert into users values ($1,$2,$3) RETURNING uid',[newName,newEmail,newPass]);
		
		query.on('error', function(err){
			res.send('error occured '+ err);
		});
		query.on('row', function(row){
			//console.log('user created?');
			result.push(row.uid);
		});
		query.on('end', function(){
			//res.send('Created new user with id '+result[0]);
			req.session.user = newEmail;
			req.session.userName = newName;
			req.session.uid = result[0];
			console.log('session log = ' + req.session.uid);
			res.redirect('/posts.html');
		});
	});
});

app.post('/login', function(req,res){
	var userEmail = req.body.email;
	var userPass = req.body.password;
	var client = new pg.Client(conString);
	var result = [];
	var userFound = false;
	var dbPass;
	var uid;
	var userName;
	client.connect(function (err,done){
		if (err){
			//res.send('sorry, error = ' +err);
			console.log('something broke '+err);
		}
		var query = client.query("SELECT * FROM users WHERE email=$1;",[userEmail]);
		query.on('error', function(err){
			res.send('Query Error ' + err);
		});
		query.on('row', function(row){
			result.push(row.password, row.uid);
			dbPass = row.password;
			uid = row.uid;
			userName = row.name;
			console.log(row.password + ' ' + row.uid);
			userFound = true;
		});
		query.on('end', function(){
			client.end();
			if (userFound){
				console.log(result[0].password);
				if (userPass == dbPass){
					//res.send("Login success");
					req.session.user = userEmail;
					req.session.uid = uid;
					req.session.userName = userName;
					res.redirect('posts.html');
				}else{
					res.send("pass does not match");
				}
			}else{
				res.send("user with that email not found");
			}
		});
	});
});

app.get('/logout', function(req,res){
	req.session.destroy(function(err){
		if (err){console.log(err)}
		else{
			res.redirect('/');
		}
	
	});
});

app.get('/getUsers', function(req, res){
	var client = new pg.Client(conString);
	var result = [];
	client.connect(function (err,done){
		if (err){
			//res.send('sorry, error = ' +err);
			console.log('something broke '+err);
		}
		var query = client.query("SELECT * FROM users;");
		query.on('error', function(err){
			res.send('Query Error ' + err);
		});
		query.on('row', function(row){
			result.push(row);
		});
		query.on('end', function(){
			client.end();
			res.send(result);
		});
	});

});

app.get('/posts.html',function(req, res){
	//Do some DB shit
	var client = new pg.Client(conString);
	var result = [];
	client.connect(function (err,done){
	
		var query = client.query("SELECT * FROM posts NATURAL JOIN users;");
		query.on('error', function(err){
			res.send('Query Error ' + err);
		});
		query.on('row', function(row){
			//console.log("pushed result "+row);
			result.push(row);
		});
		query.on('end', function(){
			client.end();
			if (req.session.user){
				//there is a user logged in currently
				res.render('posts.html',{posts:result, currUser:req.session.uid, userName:req.session.userName});
			}
			else{
				//there is no user logged in
				res.render('posts.html',{posts:result, currUser:false, userName:false});
			}
		});
		
	
	});

});
app.get('/posts:id?', function(req, res){
	var industry = req.params.id;
	//res.send(industry);
	var client = new pg.Client(conString);
	var result = [];
	client.connect(function (err,done){
	
		var query = client.query("SELECT * FROM posts NATURAL JOIN users where industry=$1;",[industry]);
		query.on('error', function(err){
			res.send('Query Error ' + err);
		});
		query.on('row', function(row){
			//console.log("pushed result "+row);
			result.push(row);
		});
		query.on('end', function(){
			client.end();
			if (req.session.user){
				//there is a user logged in currently
				res.render('posts.html',{posts:result, currUser:req.session.uid, userName:req.session.userName});
			}
			else{
				//there is no user logged in
				res.render('posts.html',{posts:result, currUser:false, userName:false});
			}
		});
		
	
	});
})
app.post('/editPost', function(req,res){
	var postId = req.body.pid;
	res.render('editPost.html', {pid:postId});
});
app.post('/editPostActive', function(req, res){
	var postId = req.body.pid;
	var postTitle = req.body.title;
	var postDescrip = req.body.description;
	var postIndustry = req.body.industry;
	var postTags = req.body.tags;
	//var tagArray = postTags.split(" ");
	var owner = req.session.uid;
	var client = new pg.Client(conString);
	var result = [];
	client.connect(function (err,done){
	
		var query = client.query("UPDATE posts SET (title, description, industry) = ($1,$2,$3) WHERE pid=$4;",[postTitle, postDescrip,postIndustry, postId]);
		query.on('error', function(err){
			res.send('Query Error ' + err);
			console.log(err);
		});
		query.on('row', function(row){
			//console.log("pushed result "+row);
			result.push(row);
		});
		query.on('end', function(){
			var tagQuery = client.query("Insert into tags values($1,$2);",[postId, postTags]);
			tagQuery.on('error', function(err){
				res.send('Query Error ' + err);

			});
			tagQuery.on('end', function(){
				client.end();
				res.redirect('/getPost'+postId);
			});
		
			
			
		});
		
	
	});
	
});
app.post('/ratePost', function(req, res){
	var postId = req.body.pid;
	var rating = req.body.rating;
	var uid = req.session.uid;
	if (rating=='like'){
		var diff = 1;
	}else{
		var diff = -1;
	}
	console.log(postId);
	console.log(rating);
	//res.send('you have rated post: '+postId+' as '+rating);
	var client = new pg.Client(conString);
	client.connect(function (err,done){
		if(rating=='like'){
			var query = client.query("UPDATE posts SET score=score+1 WHERE pid=$1", [postId]);
		}else{
			var query = client.query("UPDATE posts SET score=score-1 WHERE pid=$1", [postId]);
		}
		query.on('error', function(err){
			res.send('Query Error ' + err);
		});
		query.on('row', function(row){
			//console.log("pushed result "+row);
			result.push(row);
		});
		query.on('end', function(){
			if(rating=='like'){
				var ratingQuery = client.query("INSERT into ratings values ($1, $2, 1)", [postId,uid]);
			}else{
				var ratingQuery = client.query("INSERT into ratings values ($1, $2, 2)", [postId,uid]);
			}
			ratingQuery.on('error', function(err){
				res.send('Query Error ' + err);
			});
			ratingQuery.on('end', function(){
				client.end();
				res.redirect('/getPost'+postId);
			});
		});
		
	});
});
app.get('/getPost:id?', function(req,res){
	var pid = req.params.id;
	//console.log("pid "+pid);
	var client = new pg.Client(conString);
	var result = [];
	var owner;	
	client.connect(function (err,done){
		if (err){ console.log('something broke '+err); }
		
		var mainQuery = client.query("SELECT * FROM posts NATURAL JOIN users where pid=$1;",[pid]);
		console.log("PID = "+pid);
		
		mainQuery.on('error', function(err){
			res.send('Query Error ' + err);
		});
		mainQuery.on('row', function(row){
			result.push(row);
			owner=row.uid;
			//console.log(row.pid);
			//console.log(row.title);
			//console.log(result)
		});
		mainQuery.on('end', function(){
			var tagResult = [];
			var tagQuery = client.query("SELECT * FROM tags where pid=$1",[pid]);
			tagQuery.on('error',function(err){
				res.send('Query Error ' + err);
			});
			tagQuery.on('row', function(row){
				tagResult.push(row.tag);
			});
			tagQuery.on('end', function(){
				
				if (req.session.uid){
					//User is logged in
					var ratingResult=false;
					var ratingQuery=client.query("Select value FROM ratings where pid=$1 AND uid=$2",[pid, req.session.uid]);
					ratingQuery.on('error', function(err){
					
					});
					ratingQuery.on('row', function(row){
						ratingResult=row.value;
						console.log(row.value);
					});
					ratingQuery.on('end',function(){
						client.end();
						console.log(ratingResult);
						res.render('viewPost.html',{post:result, tags:tagResult, user:req.session.uid, owner:owner, pid:pid, rating:ratingResult});
				
					});
					//console.log(tagResult);
					} else { 
					client.end();
					//User is not logged in
					//console.log(tagResult);
					res.render('viewPost.html',{post:result, tags:tagResult, user:false, owner:owner, pid:pid, rating:false});
				}	
			});
		});
	});
});

//Page to let a user submit a new post
app.get('/createPost', function(req, res){

	//Only let user view this page if
	//they are logged in
	if (req.session.uid){
		res.render('createPost.html', {user:req.session.uid});
	}else{
		res.redirect('/');
	}
});

//app.post to create a new startup idea
app.post('/createPost', function(req,res){
	var postTitle = req.body.title;
	var postDescrip = req.body.description;
	var postIndustry = req.body.industry;
	var postTags = req.body.tags;
	//var tagArray = postTags.split(" ");
	var  owner = req.session.uid;
	var pid;
	console.log("title, descrip, industry");
	console.log(postTitle);
	console.log(postDescrip);
	console.log(postIndustry);
	console.log(owner);
	//console.log(tagArray);
	//res.redirect('/posts.html');
	
	var client = new pg.Client(conString);
	var result = [];
	client.connect(function (err,done){
		if (err){ console.log('something broke '+err); }
		var query = client.query("Insert into posts values ($1,$2,$3,0,DEFAULT,$4, DEFAULT) returning pid;",[postTitle, postDescrip, owner, postIndustry]);
		query.on('error', function(err){
			res.send('Query Error ' + err);
		});
		query.on('row', function(row){
			result.push(row);
			pid=row.pid;
		});
		query.on('end', function(){
			var tagQuery = client.query("Insert into tags values($1,$2);",[pid, postTags]);
			tagQuery.on('error', function(err){
				res.send('Query Error ' + err);

			});
			tagQuery.on('end', function(){
				client.end();
				res.redirect('/posts.html');
			});
			
		});
	});
	
});
app.post('/deletePost', function(req, res){
	var postId = req.body.pid;
	var client = new pg.Client(conString);
	var result = [];
	client.connect(function (err,done){
		if (err){ console.log('something broke '+err); }
		var query = client.query("DELETE FROM posts WHERE pid = $1;",[postId]);
		query.on('error', function(err){
			res.send('Query Error ' + err);
		});
		query.on('row', function(row){
			result.push(row);
		});
		query.on('end', function(){
			client.end();
			res.redirect('/posts.html');
		});
	});
	
});

//Page to view a user's submitted ideas
app.get('/userPosts:id?', function(req, res){
	var uid = req.session.uid;
	var id = req.params.id;
	
	//res.render('userPosts.html', {id:id, uid:uid,posts:result});
	var client = new pg.Client(conString);
	var result = [];
	client.connect(function (err,done){
	
		var query = client.query("SELECT * FROM posts NATURAL JOIN users where uid=$1;",[id]);
		query.on('error', function(err){
			res.send('Query Error ' + err);
		});
		query.on('row', function(row){
			//console.log("pushed result "+row);
			result.push(row);
		});
		query.on('end', function(){
			client.end();
			res.render('posts.html', {id:id, currUser:uid,posts:result, userName:req.session.userName});
		});
			
	});


});

app.post('/postsTag', function(req, res){
	var tag = req.body.tag;
	var order = req.body.orderBy;
	console.log('searching for tag: '+tag);
	var client = new pg.Client(conString);
	var result = [];
	client.connect(function (err,done){
		if(order=="name"){
			var query = client.query("SELECT * FROM posts NATURAL JOIN tags where tag=$1 order by title ASC;",[tag]);
		}else{
			var query = client.query("SELECT * FROM posts NATURAL JOIN tags where tag=$1 order by date DESC;",[tag]);

		}
		query.on('error', function(err){
			res.send('Query Error ' + err);
		});
		query.on('row', function(row){
			//console.log("pushed result "+row);
			result.push(row);
		});
		query.on('end', function(){
			client.end();
			if (req.session.user){
				//there is a user logged in currently
				res.render('posts.html',{posts:result, currUser:req.session.uid, userName:req.session.userName});
			}
			else{
				//there is no user logged in
				res.render('posts.html',{posts:result, currUser:false, userName:false});
			}
		});
		
	
	});
	
});

app.listen(3000);