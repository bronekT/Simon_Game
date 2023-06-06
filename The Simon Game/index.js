var buttonColours = ["red", "blue", "green", "yellow"];

var gamePattern = [];
var userClickedPattern = [];

var started = false;
var level = 0;

var isFirstClick = true;

// function handleClick() {
//   if (isFirstClick ) {
//     nextSequence();
//     isFirstClick = false;
//   } else {
//     console.log("Последующий клик, ничего не происходит");
//   }
// }
// $(document).click(function (){
//     handleClick();
// });
$(document).keydown(function() {
    if(!started){
    $("#level-title").text("Level " + (level));
    nextSequence();
    started = true;
}
    } );
    $(document).click(function() {
        if(!started){
        $("#level-title").text("Level " + (level));
        nextSequence();
        started = true;
    }
        } );

$(".btn").click(function (){
    var userChosenColour = $(this).attr("id");
    userClickedPattern.push(userChosenColour);
    animateButton(userChosenColour);
    playSound(userChosenColour);
  checkAnswer(userClickedPattern.length - 1);
  });
 
function checkAnswer(currentLevel) {
    if (gamePattern[currentLevel] === userClickedPattern[currentLevel]) {
        if(userClickedPattern.length === gamePattern.length) {
setTimeout(function() {
    nextSequence();
    },700);
    }
        } else {
            playSound("wrong");
            $("#level-title").text("GAME OVER");
            $("body").addClass("game-over");
            setTimeout(function(){  
                $("body").removeClass("game-over");
            },100 ) ;
            
            $("#level-title").text("GAME OVER");
            setTimeout(function(){
                location.reload();
            },1500);

        }
 }



function nextSequence() {
    userClickedPattern = [];
    level++;
    $("#level-title").text("Level " + (level));
var randomNumber = Math.floor(Math.random() * 4);
//console.log(randomNumber);

var randomChosenColour = buttonColours[randomNumber];
$("#" + randomChosenColour).fadeIn(100).fadeOut(100).fadeIn(100);
console.log(randomChosenColour);
gamePattern.push(randomChosenColour);
$(document).ready(function() {
   
  });
  playSound(randomChosenColour);
}


function animateButton (pressedColor) {
$("#"+ pressedColor).addClass("pressed");
setTimeout(function(){
    $("#"+ pressedColor).removeClass("pressed");
},100);
}

function playSound(name) {
    var audio = new Audio("sounds/" + name + ".mp3");
    audio.play();
}

function startOver() {
    
    level= 0 ;
    gamePattern = [];
    started = false ;
    setTimeout(function(){
        location.reload();
    },1500);
}























//function playSound (randomNumber) {
    
    //     switch (randomNumber) {
    //         case 0:
    //             var audio = new Audio ("/sounds/red.mp3");
    //             audio.play();
    //         break;
    
    //         case 1:
    //             var audio = new Audio ("/sounds/blue.mp3");
    //             audio.play();
    //         break;
    
    //         case 2:
    //             var audio = new Audio ("/sounds/green.mp3");
    //             audio.play();
    //         break;
    
    //         case 3:
    //             var audio = new Audio ("/sounds/yellow.mp3");
    //             audio.play();
    //         break;
        
    //         default: console.log(randomNumber);
    //             break;
    //     }  
    // }
