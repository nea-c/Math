data remove storage math: ans
function math:quaternion_to_axis_angle/1.acos
data modify storage math: internal.angle set compute default float {type:"mul",inputs:[2,{type:"storage","storage":"math:","path":"internal.result"}]}
data modify storage math: internal.s set compute default float {type:"sqrt",input:{type:"sub",left:1,right:{type:"pow",base:{type:"storage","storage":"math:","path":"rotation[3]"},exponent:2}}}
function math:quaternion_to_axis_angle/2.compute
data remove storage math: internal
