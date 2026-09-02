data modify storage math: ans set value {angle:0.0f,axis:[0.0f,0.0f,0.0f]}
data modify storage math: ans.angle set compute default float {"type":"storage","storage":"math:","path":"internal.w_quaternion_angle"}
data modify storage math: ans.axis[0] set compute default float {"type":"storage","storage":"math:","path":"internal.w_quaternion_axis_0"}
data modify storage math: ans.axis[1] set compute default float {"type":"storage","storage":"math:","path":"internal.w_quaternion_axis_1"}
return run data modify storage math: ans.axis[2] set compute default float {"type":"storage","storage":"math:","path":"internal.w_quaternion_axis_2"}
