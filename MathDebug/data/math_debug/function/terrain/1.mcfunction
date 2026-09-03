
data modify storage _ _.x set value 1
data modify storage _ _.y_tmp set from storage _ _.x
data modify storage _ _.z_tmp set from storage _ _.x


forceload add ~-1 ~-1 ~1 ~1


data modify storage _ _.xz_range set value 100
data modify storage _ _.y_range set value 384


data modify storage _ _.terrain_tick set compute default float {type:"add",inputs:[{type:"storage",storage:"_",path:"_.terrain_tick"},1]}



execute if predicate {type:"float_value_check",value:{type:"storage",storage:"_",path:"_.terrain_tick"},test:{min:{type:"add",inputs:[{type:"mul",inputs:[{type:"storage",storage:"_",path:"_.xz_range"},{type:"storage",storage:"_",path:"_.xz_range"},{type:"storage",storage:"_",path:"_.y_range"}]},100]}}} run return run data modify storage _ _.terrain_tick set value -1
execute if predicate {type:"float_value_check",value:{type:"storage",storage:"_",path:"_.terrain_tick"},test:{min:{type:"mul",inputs:[{type:"storage",storage:"_",path:"_.xz_range"},{type:"storage",storage:"_",path:"_.xz_range"},{type:"storage",storage:"_",path:"_.y_range"}]}}} run return fail

execute if predicate {type:"float_value_check",value:{type:"storage",storage:"_",path:"_.terrain_tick"},test:{max:0}} run return fail



data modify storage _ _.offset_x set compute default float {type:"mul",inputs:[{type:"storage",storage:"_",path:"_.z_tmp"},{type:"mod",left:{type:"storage",storage:"_",path:"_.terrain_tick"},right:{type:"storage",storage:"_",path:"_.xz_range"}}]}
data modify storage _ _.offset_y set compute default float {type:"sub",left:{type:"mul",inputs:[{type:"storage",storage:"_",path:"_.z_tmp"},{type:"mod",left:{type:"floor",input:{type:"div",left:{type:"storage",storage:"_",path:"_.terrain_tick"},right:{type:"storage",storage:"_",path:"_.xz_range"}}},right:{type:"storage",storage:"_",path:"_.y_range"}}]},right:64}
data modify storage _ _.offset_z set compute default float {type:"mul",inputs:[{type:"storage",storage:"_",path:"_.z_tmp"},{type:"floor",input:{type:"div",left:{type:"floor",input:{type:"div",left:{type:"storage",storage:"_",path:"_.terrain_tick"},right:{type:"storage",storage:"_",path:"_.xz_range"}}},right:{type:"storage",storage:"_",path:"_.y_range"}}}]}

# tellraw @a {translate:"%s - %s %s %s",with:[{nbt:"_.terrain_tick",storage:"_"},{nbt:"_.offset_x",storage:"_"},{nbt:"_.offset_y",storage:"_"},{nbt:"_.offset_z",storage:"_"}]}


execute positioned ~1 ~ ~1 run function math_debug:terrain/2.move.m with storage _ _
