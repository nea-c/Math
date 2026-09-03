

execute if predicate {type:"float_value_check",value:{type:"storage","storage":"math:","path":"internal.s"},test:{max:0}} run \
  return run function math:quaternion_to_axis_angle/3.fixed_axis


data modify storage math: ans set value {angle:0.0f,axis:[0.0f,0.0f,0.0f]}
data modify storage math: ans.angle set from storage math: internal.angle
data modify storage math: ans.axis[0] set compute default float {type:"div",left:{type:"storage","storage":"math:","path":"rotation[0]"},right:{type:"storage","storage":"math:","path":"internal.s"}}
data modify storage math: ans.axis[1] set compute default float {type:"div",left:{type:"storage","storage":"math:","path":"rotation[1]"},right:{type:"storage","storage":"math:","path":"internal.s"}}
data modify storage math: ans.axis[2] set compute default float {type:"div",left:{type:"storage","storage":"math:","path":"rotation[2]"},right:{type:"storage","storage":"math:","path":"internal.s"}}
