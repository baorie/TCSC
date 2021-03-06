const crypto = require('crypto');
const passwordHashAlgorithm = 'sha1';

//todo
//have thing to keep track of questions stats from team point of view (who has been answering and stuff)

module.exports = function(redis) {
    var computeSHA1 = function(str) { return crypto.createHash(passwordHashAlgorithm).update(str).digest('hex'); };
    var emptyFunction = function() {};

    const Question = require('./question.js')(redis);

    function nextLetter(s){
        return s.replace(/([a-zA-Z])[^a-zA-Z]*$/, function(a){
            var c = a.charCodeAt(0);
            switch(c){
                case 90: return 'A';
                case 122: return 'a';
                default: return String.fromCharCode(++c);
            }
        });
    }


    var team = {
        createTeam: function (name, school, leader_id, password, callback) {
            callback = callback || emptyFunction;
            redis.incr('global:nextTeamId', function (error, id) {
                if (error) {
                    callback(false);
                    return;
                }

                redis.setnx("team_name:" + name.toLowerCase() + ":id", id, function (err, set) {
                    if (err) {
                        callback(false);
                        return;
                    }
                    if (set == 0) {
                        callback("name");
                        return;
                    } //means team name is already taken
                    redis
                        .multi()
                        .set("user:" + leader_id + ":team", id)
                        .set("team:" + id + ":name", name.toLowerCase() + ":" + name)
                        .set("team:" + id + ":points", 0)
                        .zadd("global:leaderboard_name", 0, name.toLowerCase() + ":" + name)
                        .zadd("global:leaderboard", 0, id)
                        .set("team:" + id + ":school", school)
                        .sadd("team:" + id + ":members", leader_id)
                        .set("team:" + id + ":leader", leader_id)
                        .set("team:" + id + ":password", computeSHA1(password))
                        .set("team:" + id + ":message_order", 0)
                        .sadd("school:" + school + ":teams", id)
                        .exec(function (error, results) {
                            if (error) {
                                callback(false);
                                return;
                            }
                            callback(id);
                        });
                });
            });
        },

        getTeam: function(id, callback){
            callback = callback || emptyFunction;

            redis
                .multi()
                .get("team:" + id + ":name")
                .get("team:" + id + ":points")
                .exec(function (error, results) {
                    if (error) {
                        console.log("mmmsjs");
                        callback(false);
                        return;
                    }
                    callback({name:results[0].slice(results[0].indexOf(':')+1,results[0].length), points:results[1]});
                    return;
                });
        },

        getTeamMembers: function (team_id, callback) {
            callback = callback || emptyFunction;
            redis.smembers("team:" + team_id + ":members", function (err, mems) {
                if (err) {
                    callback(false);
                    return;
                }
                callback(true);
                return mems;
            });
        },

        addMember: function (team_id, user_id, callback) {
            callback = callback || emptyFunction;
            //add a test to make sure not too many people in team
            redis.sadd("team:" + team_id + ":members", user_id, function (err, set) {
                if (err) {
                    callback(false);
                    return;
                }
                if (set == 0) {
                    callback(false);
                    return;
                } //means user was already part of this team
                callback(true);
                return(true);
            });
        },

        removeMember: function (team_id, user_id, callback) {
            callback = callback || emptyFunction;
            redis.srem("team:" + team_id + ":members", user_id, function (err, set) {
                if (err) {
                    callback(false);
                    return;
                }
                if (set == 0) {
                    callback(false);
                    return;
                } //means user was not part of this team, lol
                callback(true);
            });
        },

        validateTeam: function (team_name, pass, callback) {
            callback = callback || emptyFunction;
            redis.get("team_name:" + team_name.toLowerCase() + ":id", function (error, team_id) {
                if (error) {
                    callback(false);
                    return;
                }
                console.log(team_name);
                console.log(error);
                console.log(team_id);
                redis.get("team:" + team_id + ":password", function (err, password) {
                    if (err) {
                        callback(false);
                        return;
                    }
                    console.log(password);
                    console.log(computeSHA1(pass));
                    if(computeSHA1(pass) === password){
                        callback(true);
                        return(true);
                    }else{
                        callback("invalid_pass");
                        return("invalid_pass");
                    }
                });
            });
        },

        searchTeam: function (input, callback) {
            input = input.toLowerCase();
            console.log("[" + input);
            console.log("(" + input.substring(0, input.length -1) + nextLetter(input.slice(-1)));
            redis.zrange("global:leaderboard_name", 0, -1, function(err, woah){
                console.log(woah);
            });
            redis.zrangebylex("global:leaderboard_name", "[" + input, "(" + input.substring(0, input.length -1) + nextLetter(input.slice(-1)), function(err, array){
                console.log(array.toString());
                callback(array);
            });
            //include school search ... it gone be cool AF
            //console.log(query.toString());
        },

        followTeam: function (other_id, team_id, callback) {
            callback = callback || emptyFunction;
            redis.sadd("team:" + team_id + ":following", other_id, function (err, set) {
                if (err) {
                    callback(false);
                    return;
                }
                if (set == 0) {
                    callback(false);
                    return;
                } //means team was already following other team
                redis.sadd("team:" + other_id + "followers", team_id, function (e) {
                    if (e) {
                        callback(false);
                        return;
                    }
                    callback(true);
                });
            });
        },


        unfollowTeam: function (other_id, team_id, callback) {
            callback = callback || emptyFunction;
            redis.srem("team:" + team_id + ":following", other_id, function (err, num) {
                if (err) {
                    callback(false);
                    return;
                }
                if (num == 0) {
                    callback(false);
                    return;
                } //means they weren't following the team already
                redis.srem("team:" + other_id + "followers", team_id, function (e) {
                    if (e) {
                        callback(false);
                        return;
                    }
                    callback(true);
                });
            });
        },

        getLeaderboard: function(callback) {
            callback = callback || emptyFunction;
            redis.zrange("global:leaderboard", 0 ,-1, function(err, board){
                if (err) {
                    callback(false);
                    return;
                }
                callback(board);
            });
        },

        getFollowingLeaderboard: function(team_id, callback) {
            callback = callback || emptyFunction;
            redis.zrange("team:" + team_id + ":local_board", 0, -1, function(err, board){
                if (err) {
                    callback(false);
                    return;
                }
                callback(board);
            });
        },

        getQuestions: function(team_id, callback){
            //redis.zadd("team:" + team_id + ":question_order", 3, 4);
            redis.zrevrange("team:" + team_id + ":question_order", 0, -1, "withscores", function(err, questions){
                console.log(questions);
                if(!err || !questions || questions.length === 0 ){
                    redis.get("global:question_id", function(err, val){
                        for(x = 1; x <= val; x ++){
                            Question.getQuestion(x, function(v){
                                callback(v);
                            });
                        }
                    });
                }
                else{
                    var c = 0;
                    var q_id = -1;
                    var order = -3;
                    for (var q in questions){
                        if(c % 2 == 0){
                            q_id = q;
                        }
                        else{
                            order = q;

                            if(order <= 0){
                                redis.get("global:question_id", function(err, val){
                                    for(x = 1; x <= val; x ++){
                                        if(question.indexOf(x) != -1)
                                        Question.getQuestion(x, function(v){
                                            callback(v);
                                        });
                                    }
                                });
                            }

                            Question.getQuestion(q_id, function(v){
                                callback(v);
                            });

                        }
                        c = (c + 1) % 2
                    }
                }
            });

        },

        answeredQuestions: function (team_id, callback) {
            callback = callback || emptyFunction;
            redis.get("team:" + team_id + ":questions", function (err, q) {
                if (err) {
                    callback(false);
                    return;
                }
                callback(q);
                return q;
            });
        },

        attemptedQuestion: function (team_id, user_id, question_id, correct, callback) {
            callback = callback || emptyFunction;
            var d = new Date();
            var time = d.getTime();
            if (correct) {
                redis.zadd("team:" + team_id + ":questions", time, question_id + ":" + user_id + ":" + time, function (err, set) {
                    if (err) {
                        callback(false);
                        return;
                    }
                    if (set == 0) {
                        callback(false);
                        return;
                    } //means team already answered question
                });
                redis.zadd("team:" + team_id + ":question_order", -1, question_id);
                redis.get("question:" + question_id + ":points", function(err, score){
                    if (err) {
                        callback(false);
                        return;
                    }
                    redis.incrby("question:" + question_id + ":teams_answered", 1);
                    redis.incrby("team:" + team_id + ":points", score);
                });
            }
            else {
                redis.zincrby("team:" + team_id + ":question_order", 1, question_id);
                redis.sadd("team:" + team_id + ":question:" + question_id + ":working_on", user_id);
            }
            redis.zadd("team:" + team_id + ":attempts", time, question_id + ":" + user_id + ":" + time, function (err, set) {
                if (err) {
                    callback(false);
                    return;
                }
                if (set == 0) {
                    callback(false);
                    return;
                }
                callback(true);
            });
        },

        notifyTeam: function (team_id, io, type, data, except, callback) {
            callback = callback || emptyFunction;
            redis.smembers("team:" + team_id + ":members", function(err, members){
                if (error) {callback(false);return;}

                //for each member
                    //if member != except
                        //io.emit("notification:" + member, type, data)
            });
        }
    };

    return team;
};