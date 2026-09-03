

data modify storage _ _.z set from storage _ _.z_tmp
function math_debug:perlin/2.z_loop

data modify storage _ _.x set compute default integer {type:"sub",left:{type:"storage",storage:"_",path:"_.x"},right:1}
execute if predicate {type:"int_value_check",value:{type:"storage",storage:"_",path:"_.x"},test:{min:1}} run function math_debug:perlin/1.x_loop

