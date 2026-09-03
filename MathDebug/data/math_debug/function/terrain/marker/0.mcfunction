


forceload add ~ ~ ~16 ~16

# execute summon marker run function math_debug:terrain/marker/1
# data modify storage math: a set from storage _ _.pos[0]
# data modify storage math: b set from storage _ _.pos[1]
# data modify storage math: c set from storage _ _.pos[2]


data modify storage math: a set from storage _ _.offset_x
data modify storage math: b set from storage _ _.offset_y
data modify storage math: c set from storage _ _.offset_z
data modify storage math: seed set value 1
function #math:vanilla_like_terrain


setblock ~ ~ ~ air strict


execute unless predicate {type:"float_value_check",value:{type:"storage",storage:"math:",path:"ans"},test:{min:0}} run \
  return fail


setblock ~ ~ ~ gold_block strict


