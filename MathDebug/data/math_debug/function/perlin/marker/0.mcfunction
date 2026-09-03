


forceload add ~ ~ ~16 ~16

execute summon marker run function math_debug:perlin/marker/1


data modify storage math: a set compute default float {type:"mul",inputs:[{type:"storage",storage:"_",path:"_.pos[2]"},0.05]}
data modify storage math: b set compute default float {type:"mul",inputs:[{type:"storage",storage:"_",path:"_.pos[0]"},0.05]}
function #math:perlin

data modify storage _ _.y set compute default float {type:"mul",inputs:[{type:"storage",storage:"math:",path:"ans"},0.25]}

fill ~ 64 ~ ~ 319 ~ air strict
function math_debug:perlin/marker/2.m with storage _ _


