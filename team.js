const crypto = require('crypto');
const passwordHashAlgorithm = 'sha1';

module.exports = function(redis) {
    var computeSHA1 = function(str) { return crypto.createHash(passwordHashAlgorithm).update(str).digest('hex'); };
    var emptyFunction = function() {};
    
    var team = {
    	createTeam: function(name, school, leader, following, followers, answered, password, callback){
    		callback = callback || emptyFunction;
    		redis.incr('global:nextTeamId', function(error, id) {
    			if (error) {callback(false);return;}
                id --;

                redis.setnx("team_name:" + name + ":id", id, function(err, set){
                	if (err) {callback(false);return;}
                	if (set==0){callback(false);return;} //means team name is already taken)
						redis
							.multi()
							.set("team:" + id + ":name", name)
                            .set("team:" + id + ":points", 0)
                            .set("team:" + id + ":school", school)
                            .sadd("team:" + id + ":members", leader)
                            .set("team:" + id + ":leader", leader)
                            .set("team:" + id + ":password", computeSHA1(password))
                            .exec(function(error, results){
                                if(error){callback(false);return;}
                                callback(true);
                            });
                };
    		}
    	},

        addMember: function(team_id, user_id, callback){
            callback = callback || emptyFunction;
            redis.sadd("team:" + team_id + ":members", user_id, function(err, set){
                if (err) {callback(false);return;}
                if (set==0){callback(false);return;} //means user was already part of this team
            });
        },

        validateTeam: function(team_name, password, callback){
            callback = callback || emptyFunction;


        }
    };

    return team;
};

module.exports()