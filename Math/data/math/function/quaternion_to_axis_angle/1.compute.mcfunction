execute unless data storage math: rotation[3] run return 1
execute if data storage math: rotation[4] run return 1
data modify storage math: internal.w_quaternion_component_0 set compute default float {"type":"minecraft:storage","storage":"math:","path":"rotation[0]"}
data modify storage math: internal.w_quaternion_component_1 set compute default float {"type":"minecraft:storage","storage":"math:","path":"rotation[1]"}
data modify storage math: internal.w_quaternion_component_2 set compute default float {"type":"minecraft:storage","storage":"math:","path":"rotation[2]"}
data modify storage math: internal.w_quaternion_component_3 set compute default float {"type":"minecraft:storage","storage":"math:","path":"rotation[3]"}
data modify storage math: internal.w_quaternion_maximum set compute default float math:quaternion_to_axis_angle/normalize/maximum
data modify storage math: internal.w_comparison.predicate.quaternion_to_axis_angle_maximum_zero set compute default float math:.validation/predicate/quaternion_to_axis_angle/maximum_zero/value
execute if predicate math:.validation/quaternion_to_axis_angle/maximum_zero run return 1
function math:quaternion_to_axis_angle/2.normalize
