data modify storage math: internal.w_quaternion_component_0 set compute default float {"type":"minecraft:storage","storage":"math:","path":"rotation[0]"}
data modify storage math: internal.w_quaternion_component_1 set compute default float {"type":"minecraft:storage","storage":"math:","path":"rotation[1]"}
data modify storage math: internal.w_quaternion_component_2 set compute default float {"type":"minecraft:storage","storage":"math:","path":"rotation[2]"}
data modify storage math: internal.w_quaternion_component_3 set compute default float {"type":"minecraft:storage","storage":"math:","path":"rotation[3]"}
data modify storage math: internal.w_quaternion_maximum set compute default float math:quaternion_to_axis_angle/normalize/maximum
function math:quaternion_to_axis_angle/2.normalize
