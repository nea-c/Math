
data modify storage _ _ set value {}
data modify storage _ _.x set value 16
data modify storage _ _.z_tmp set from storage _ _.x


forceload add ~-1 ~-1 ~1 ~1

scoreboard players set #div value 20
scoreboard players add #perlin value 1
execute unless score #perlin value matches -1.. run return fail
execute if score #perlin value matches -1 run return run kill @e[type=item_display,tag=perlin_debug]

scoreboard players operation #div_ value = #div value
scoreboard players operation #div_ value *= #div value

scoreboard players operation #_ value = #perlin value
scoreboard players operation #_ value %= #div_ value
execute if score #perlin value matches 1.. if score #_ value matches 0 run scoreboard players set #perlin value -100



data modify storage _ _.offset_x set compute default float {type:"mul",inputs:[{type:"storage",storage:"_",path:"_.z_tmp"},{type:"mod",left:{type:"from_int",input:{type:"score",target:{type:"fixed",name:"#perlin"},score:"value"}},right:{type:"from_int",input:{type:"score",target:{type:"fixed",name:"#div"},score:"value"}}}]}
data modify storage _ _.offset_z set compute default float {type:"mul",inputs:[{type:"storage",storage:"_",path:"_.z_tmp"},{type:"floor",input:{type:"div",left:{type:"from_int",input:{type:"score",target:{type:"fixed",name:"#perlin"},score:"value"}},right:{type:"from_int",input:{type:"score",target:{type:"fixed",name:"#div"},score:"value"}}}}]}

function math_debug:perlin/1.x_loop

