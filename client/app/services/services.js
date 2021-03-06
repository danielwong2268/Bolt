angular.module('bolt.services', [])

// Handle all location-based features
.factory('Geo', function ($window) {
  var session = $window.localStorage;
  var mainMap;
  var destinationMarker;
  var directionsService = new google.maps.DirectionsService();
  var directionsRenderer = new google.maps.DirectionsRenderer();
  var route;
  var initialLat;
  var initialLng;


  // Math functions
  var sqrt = Math.sqrt;
  var floor = Math.floor;
  var random = Math.random;
  var pow2 = function (num) {
    return Math.pow(num, 2);
  };

  // Create map around the users current location and their destination
  var makeInitialMap = function ($scope, destination) {
    navigator.geolocation.getCurrentPosition(function (position) {
      $scope.initialLoc = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };

        makeMap({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }, $scope);

      }, function (err) {
        console.error(err);
      });
    var makeMap = function (currentLatLngObj, $scope) {
      //find random destination coordinates, an obj with {lat:latval, lng: lngval}
      var destinationCoordinates = destination ||
          randomCoordsAlongCircumference(currentLatLngObj, session.preferredDistance);
          //create a map within the div with the id 'map'
      console.log('dest coords', destinationCoordinates);
      mainMap = new google.maps.Map(document.getElementById('map'), {
        center: new google.maps.LatLng(currentLatLngObj.lat, currentLatLngObj.lng),
        zoom: 13,
        disableDefaultUI: true
      });
      //get the directions
      directionsRenderer.setMap(mainMap);
      //put down marker
      $scope.currentLocMarker = new google.maps.Marker({
        position: new google.maps.LatLng(currentLatLngObj.lat, currentLatLngObj.lng),
        map: mainMap,
        animation: google.maps.Animation.DROP,
        icon: '/assets/bolt.png'
      });
      //set the start/end routes, based on the current location and the destination
      var startOfRoute = new google.maps.LatLng($scope.currentLocMarker.position.lat(), $scope.currentLocMarker.position.lng());
      var endOfRoute = new google.maps.LatLng(destinationCoordinates.lat, destinationCoordinates.lng);

      $scope.destination = {
        lat: endOfRoute.lat(),
        lng: endOfRoute.lng()
      };

      console.log('scope destination', $scope.destination);

      route = directionsService.route({
        origin: startOfRoute,
        destination: endOfRoute,
        travelMode: google.maps.TravelMode.WALKING,
        unitSystem: google.maps.UnitSystem.IMPERIAL,
        provideRouteAlternatives: false
      }, function (response, status) {
        directionsRenderer.setDirections(response);
        var totalDistance = 0;
        // Add up distance for all legs of the journey
        for (var i = 0; i < response.routes[0].legs.length; i++) {
          //distance is a human-readable string.
          var distance = response.routes[0].legs[i].distance.text;
          if (distance.substring(distance.length - 2) === "ft") {
            //convert the distance from feet to miles
            distance = (distance.substring(0, distance.length - 3) / 5280).toString().substring(0, 3) + " mi";
          }
          totalDistance += distance;
        }
        totalDistance = parseFloat(totalDistance) || 0.1; // If run distance is small display 0.1 miles
        console.log('tot distance .... ', totalDistance);
        $scope.totalDistance = totalDistance;

        // Change this to pull the users speed from their profile
        var userMinPerMile = 10;
        var hours = Math.floor(userMinPerMile * totalDistance / 60);
        var minutes = userMinPerMile * totalDistance;
        var seconds = minutes * 60;

        // Display projected time in a freindly format
        $scope.hasHours = hours > 0;
        $scope.goldTime = moment().second(seconds * 0.9).minute(minutes * 0.9).hour(hours * 0.9);
        $scope.silverTime = moment().second(seconds * 1.0).minute(minutes * 1.0).hour(hours * 1.0);
        $scope.bronzeTime = moment().second(seconds * 1.1).minute(minutes * 1.1).hour(hours * 1.1);
        $scope.$digest();
      });
    };
  };

  // Calculate distance between two coordinates
  var distBetween = function (loc1, loc2) {
    return sqrt(pow2(loc1.lat - loc2.lat) + pow2(loc1.lng - loc2.lng));
  };

  // Calculate the percentage of the total route distance that the user has run
  var calculatePercentageRouteRun = function ($scope, loc1, loc2) {
    $scope.distanceRun += distBetween(loc1, loc2);
    var percentageRun = Math.ceil(($scope.distanceRun / $scope.totalDistance) * 100);
    return percentageRun;
  };

  // Updates the current user position, and calculates the percentage of the total route completed.
  var updateCurrentPosition = function ($scope) {
    console.log($scope.userLocation);
    if ($scope.userLocation) {
      var prevLocation = {
        lat: $scope.userLocation.lat,
        lng: $scope.userLocation.lng
      };
    }
    navigator.geolocation.getCurrentPosition(function (position) {
      $scope.currentLocMarker.setPosition(new google.maps.LatLng(position.coords.latitude, position.coords.longitude));
      if ($scope) {
        $scope.userLocation = {
          lat: $scope.currentLocMarker.position.lat(),
          lng: $scope.currentLocMarker.position.lng()
        };
        if (prevLocation) {
          $scope.percentComplete = calculatePercentageRouteRun($scope, prevLocation, $scope.userLocation);
          console.log('prevPosition: ', prevLocation);
          console.log('userLocation: ', $scope.userLocation);
        }
      }
    }, function (err) {
      console.error(err);
    });
  };

  var randomCoordsAlongCircumference = function (originObj, radius) {
    var randomTheta = Math.random() * 2 * Math.PI;
    return {
      lat: originObj.lat + (radius / 69 * Math.cos(randomTheta)),
      lng: originObj.lng + (radius / 69 * Math.sin(randomTheta))
    };
  };

  return {
    makeInitialMap: makeInitialMap,
    updateCurrentPosition: updateCurrentPosition,
    distBetween: distBetween,
    calculatePercentageRouteRun: calculatePercentageRouteRun
  };

})

// Handle all tracking and rewards during the run
.factory('Run', function ($http) {

  var pointsInTime = {
    'Gold': '',
    'Silver': '',
    'Bronze': ''
  };

  var updateTimeUntilMedal = function (secondsToMedal) {
    return moment().second(secondsToMedal).minute(secondsToMedal / 60);
  };

  // Could refactor to handle a {gold, silver, bronze} object
  var setPointsInTime = function ($scope) {
    pointsInTime['Gold'] = moment().add($scope.goldTime.second(), 'seconds').add($scope.goldTime.minute(), 'minutes');
    pointsInTime['Silver'] = moment().add($scope.silverTime.second(), 'seconds').add($scope.silverTime.minute(), 'minutes');
    pointsInTime['Bronze'] = moment().add($scope.bronzeTime.second(), 'seconds').add($scope.bronzeTime.minute(), 'minutes');
  };

  // Initialize medal countdown to gold
  var setInitialMedalGoal = function ($scope) {
    $scope.currentMedal = 'Gold';
    var secondsToGold = pointsInTime['Gold'].diff(moment(), 'seconds');
    $scope.timeUntilCurrentMedal = updateTimeUntilMedal(secondsToGold);
  };

  // Make sure the next best medal is displayed with the correct time
  // Could refactor to handle a {gold, silver, bronze} object
  var updateGoalTimes = function ($scope) {
    if ($scope.currentMedal === 'Gold') {
      var secondsToGold = pointsInTime['Gold'].diff(moment(), 'seconds');
      if (secondsToGold === 0) {
        var secondsToSilver = pointsInTime['Silver'].diff(moment(), 'seconds');
        $scope.timeUntilCurrentMedal = updateTimeUntilMedal(secondsToSilver);
        $scope.currentMedal = 'Silver';
      } else {
        $scope.timeUntilCurrentMedal = updateTimeUntilMedal(secondsToGold);
      }
    } else if ($scope.currentMedal === 'Silver') {
      var secondsToSilver = pointsInTime['Silver'].diff(moment(), 'seconds');
      if (secondsToSilver === 0) {
        var secondsToBronze = pointsInTime['Bronze'].diff(moment(), 'seconds');
        $scope.timeUntilCurrentMedal = updateTimeUntilMedal(secondsToBronze);
        $scope.currentMedal = 'Bronze';
      } else {
        $scope.timeUntilCurrentMedal = updateTimeUntilMedal(secondsToSilver);
      }
    } else if ($scope.currentMedal === 'Bronze') {
      var secondsToBronze = pointsInTime['Bronze'].diff(moment(), 'seconds');
      if (secondsToBronze === 0) {
        $scope.currentMedal = 'High Five';
        $scope.timeUntilCurrentMedal = '';
      } else {
        $scope.timeUntilCurrentMedal = updateTimeUntilMedal(secondsToBronze);
      }
    }
  };

  return {
    setPointsInTime: setPointsInTime,
    setInitialMedalGoal: setInitialMedalGoal,
    updateGoalTimes: updateGoalTimes
  };
})

// Update and retrieve user information
.factory('Profile', function ($http) {
    var updateUser = function (newInfo, user) {
      return $http({
        method: 'PUT',
        url: '/api/users/profile',
        data: {
          newInfo: newInfo,
          //The above 'newInfo' object needs to contain the same keys as
          //the DB, or else it will fail to PUT. E.g. newInfo needs to have
          //a 'firstName' key in the incoming object in order to update the
          //'firstName' key in the User DB. If it's named something else
          //('first', 'firstname', 'firstN', etc.), it won't work
          username: user.username
        }
      }).then(function (res) {
        return res;
      });
    };

    var getUser = function () {
      return $http({
        method: 'GET',
        url: '/api/users/profile'
      }).then(function (user) {
        return user.data;
      });
    };

    var sendFriendRequest = function (username, friendUsername) {
      return $http({
        method: 'POST',
        url: '/api/users/friendRequest',
        data: {
          username: username,
          friendUsername: friendUsername
        }
      }).then(function (res) {
        if ( res.data === 'User does not exist' || res.data === 'You have already sent this user a friend request') {
          return res.data;
        } else {
          console.log( 'Friend request made' );
          return res;
        }
      });
    };
    var sendChallengeRequest = function (run, $scope) {
      console.log("run before post", run);
      return $http({
        method: 'POST',
        url: '/api/users/challengeRequest',
        data: {
          run: run,
          username: $scope.friend
        }
      }).then(function (res) { return res})

    }

    var handleFriendRequest = function (action, self, newFriend) {
      return $http({
        method: 'POST',
        url: '/api/users/handleFriendRequestAction',
        data: {
          action: action,
          self: self,
          newFriend: newFriend
        }
      }).then(function (res) {
        return res;
      });
    };

    var getFriends = function () {
      return $http({
        method: 'GET',
        url: '/api/users/handleGetFriends'
      }).then(function (friends) {
        return friends;
      });
    };

    /* Daniel Here - I wrote my own version of updateUser */
    var updateUserInfo = function (newInfo, user) {
      return $http({
        method: 'POST',
        url: '/api/users/updateUserInfo',
        data: {
          newInfo: newInfo,
          username: user
        }
      }).then(function (res) {
        return res;
      });
    };

  return {
    sendChallengeRequest: sendChallengeRequest,
    updateUser: updateUser,
    getUser: getUser,
    sendFriendRequest: sendFriendRequest,
    handleFriendRequest: handleFriendRequest,
    getFriends: getFriends,
    updateUserInfo: updateUserInfo
  };
})

// Handle multiplayer sessions to db
.factory('MultiGame', function ($http) {
  return {
    makeGame : function (id, user1, user2) {
      return $http({
        method: 'POST',
        url: '/api/games',
        data: {
          id: id
        }
      }).then(function (res) {
        return res;
      });
    },

    // Optional progess argument, hardcoded for handling multiRun progress bar updating
    updateGame : function (id, field, progress) {
      //field is equal to either user1 or user2
      return $http({
        method: 'POST',
        url: '/api/games/update',
        data: {
          id: id,
          field: field,
          progress: progress
        }
      }).then(function (res) {
        return res;
      });
    },

    getGame : function (id) {
      return $http({
        method: 'GET',
        url: '/api/games/' + id
      }).then(function (res) {
        return res.data;
      });
    },

    removeGame: function (id) {
      console.log(id);
      return $http({
        method: 'POST',
        url: '/api/games/remove',
        data: {
          id: id
        }
      }).then(function (res) {
        return res;
      });
    }
  };
})

// Handle Authentication
.factory('Auth', function ($http, $location, $window) {
  // it is responsible for authenticating our user
  // by exchanging the user's username and password
  // for a JWT from the server
  // that JWT is then stored in localStorage as 'com.bolt'
  // after you signin/signup open devtools, click resources,
  // then localStorage and you'll see your token from the server
  var signin = function (user) {
    return $http({
      method: 'POST',
      url: '/api/users/signin',
      data: user
    })
    .then(function (resp) {
      return resp.data;
    });
  };

  var signup = function (user) {
    return $http({
      method: 'POST',
      url: '/api/users/signup',
      data: user
    })
    .then(function (resp) {
      return resp.data.token;
    });
  };

  // Checks token and ensures leftover tokens without usernames don't fly
  var isAuth = function () {
    return (!!$window.localStorage.getItem('com.bolt'))
        && (!!$window.localStorage.getItem('username'));
  };

  var signout = function () {
    $http({
      method: 'GET',
      url: '/api/users/signout'
    })
    .then(function (data) {
      $window.localStorage.clear();
      $location.path('/signin');
    });
  };


  return {
    signin: signin,
    signup: signup,
    isAuth: isAuth,
    signout: signout
  };
})

.factory('raceFriends', function ($http, $location, $window) {
  var submitLiveChallenge = function (user, opponent) {
    return $http({
      method: 'POST',
      url: '/api/users/submitLiveChallenge',
      data: {
        user: user,
        opponent: opponent
      }
    }).then( function (res) {
      return res;
    });
  };



  return {
    submitLiveChallenge: submitLiveChallenge
  };
})

.factory('soloChallenge', function ($http, $location, $window, Geo) {
  var session = $window.localStorage;
  var mainMap;
  var currentLocMarker;
  var destinationMarker;
  var directionsService = new google.maps.DirectionsService();
  var directionsRenderer = new google.maps.DirectionsRenderer();
  var route;
  var initialLat;
  var initialLng;


  // Math functions
  var sqrt = Math.sqrt;
  var floor = Math.floor;
  var random = Math.random;
  var pow2 = function (num) {
    return Math.pow(num, 2);
  };

  // Create map around the users current location and their destination
  var makeInitialMap = function ($scope, destination) {
    var makeMap = function (currentLatLngObj, $scope) {
          //create a map within the div with the id 'map'
      mainMap = new google.maps.Map(document.getElementById('map'), {
        center: new google.maps.LatLng(currentLatLngObj.lat, currentLatLngObj.lng),
        zoom: 13,
        disableDefaultUI: true
      });
      //get the directions
      directionsRenderer.setMap(mainMap);
      //put down marker
      $scope.currentLocMarker = new google.maps.Marker({
        // TODO: Change this to user's current location, along with center for mainMap, to validate user's starting point of run
        position: new google.maps.LatLng(currentLatLngObj.lat, currentLatLngObj.lng),
        map: mainMap,
        animation: google.maps.Animation.DROP,
        icon: '/assets/bolt.png'
      });
      //set the start/end routes, based on the current location and the destination
      var startOfRoute = new google.maps.LatLng(currentLatLngObj.lat, currentLatLngObj.lng);
      var endOfRoute = new google.maps.LatLng(destination.lat, destination.lng);
      route = directionsService.route({
        origin: startOfRoute,
        destination: endOfRoute,
        travelMode: google.maps.TravelMode.WALKING,
        unitSystem: google.maps.UnitSystem.IMPERIAL,
        provideRouteAlternatives: false
      }, function (response, status) {
        directionsRenderer.setDirections(response);
        var totalDistance = 0;
        // Add up distance for all legs of the journey
        for (var i = 0; i < response.routes[0].legs.length; i++) {
          //distance is a human-readable string.
          var distance = response.routes[0].legs[i].distance.text;
          if (distance.substring(distance.length - 2) === "ft") {
            //convert the distance from feet to miles
            distance = (distance.substring(0, distance.length - 3) / 5280).toString().substring(0, 3) + " mi";
          }
          totalDistance += distance;
        }
        totalDistance = parseFloat(totalDistance) || 0.1; // If run distance is small display 0.1 miles
        $scope.totalDistance = totalDistance;
      });
    };

    makeMap({
      lat: $scope.initialLoc.lat,
      lng: $scope.initialLoc.lng
    }, $scope);
  };

  var updateCurrentPosition = function ($scope) {
    if ($scope.userLocation) {
      var prevLocation = {
        lat: $scope.userLocation.lat,
        lng: $scope.userLocation.lng
      };
    }
    navigator.geolocation.getCurrentPosition(function (position) {
      $scope.currentLocMarker.setPosition(new google.maps.LatLng(position.coords.latitude, position.coords.longitude));
      if ($scope) {
        $scope.userLocation = {
          lat: $scope.currentLocMarker.position.lat(),
          lng: $scope.currentLocMarker.position.lng()
        };
        if (prevLocation) {
          $scope.percentComplete = Geo.calculatePercentageRouteRun($scope, prevLocation, $scope.userLocation);
        }
      }
    }, function (err) {
      console.error(err);
    });
  };

  return {
    makeInitialMap: makeInitialMap,
    updateCurrentPosition: updateCurrentPosition
  };
});






















