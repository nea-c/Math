

function math_debug:perlin/3.move.m with storage _ _

data modify storage _ _.z set compute default integer {type:"sub",left:{type:"storage",storage:"_",path:"_.z"},right:1}
execute if predicate {type:"int_value_check",value:{type:"storage",storage:"_",path:"_.z"},test:{min:1}} run function math_debug:perlin/2.z_loop

