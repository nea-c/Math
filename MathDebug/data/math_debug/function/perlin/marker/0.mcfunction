


forceload add ~ ~ ~16 ~16

# execute summon marker run function math_debug:perlin/marker/1


data modify storage math: a set compute default float {type:"add",inputs:[{type:"storage",storage:"_",path:"_.x"},{type:"storage",storage:"_",path:"_.offset_x"}]}
data modify storage math: b set compute default float {type:"add",inputs:[{type:"storage",storage:"_",path:"_.z"},{type:"storage",storage:"_",path:"_.offset_z"}]}
data modify storage math: c set value 1
data modify storage math: frequency set value 0.02
data modify storage math: seed set value 2

data modify storage math: min set value -50
data modify storage math: max set value 50
function #math:vanilla_like_terrain

data modify storage _ _.y set compute default float {type:"mul",inputs:[{type:"storage",storage:"math:",path:"ans"},2]}

fill ~ 64 ~ ~ 256 ~ air strict
function math_debug:perlin/marker/2.m with storage _ _


