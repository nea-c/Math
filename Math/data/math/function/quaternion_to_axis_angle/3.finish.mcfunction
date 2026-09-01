data modify storage math: internal.w_comparison.predicate.quaternion_to_axis_angle_result_angle_finite set compute default float math:.validation/predicate/quaternion_to_axis_angle/result_angle_finite/value
execute unless predicate math:.validation/quaternion_to_axis_angle/result_angle_finite run return run function math:.common/_error/result_out_of_range
data modify storage math: internal.w_comparison.predicate.quaternion_to_axis_angle_result_axis_0_finite set compute default float math:.validation/predicate/quaternion_to_axis_angle/result_axis_0_finite/value
execute unless predicate math:.validation/quaternion_to_axis_angle/result_axis_0_finite run return run function math:.common/_error/result_out_of_range
data modify storage math: internal.w_comparison.predicate.quaternion_to_axis_angle_result_axis_1_finite set compute default float math:.validation/predicate/quaternion_to_axis_angle/result_axis_1_finite/value
execute unless predicate math:.validation/quaternion_to_axis_angle/result_axis_1_finite run return run function math:.common/_error/result_out_of_range
data modify storage math: internal.w_comparison.predicate.quaternion_to_axis_angle_result_axis_2_finite set compute default float math:.validation/predicate/quaternion_to_axis_angle/result_axis_2_finite/value
execute unless predicate math:.validation/quaternion_to_axis_angle/result_axis_2_finite run return run function math:.common/_error/result_out_of_range
data modify storage math: ans set value {angle:0.0f,axis:[0.0f,0.0f,0.0f]}
data modify storage math: ans.angle set compute default float math:quaternion_to_axis_angle/output/stored_angle
data modify storage math: ans.axis[0] set compute default float math:quaternion_to_axis_angle/output/stored_axis_0
data modify storage math: ans.axis[1] set compute default float math:quaternion_to_axis_angle/output/stored_axis_1
data modify storage math: ans.axis[2] set compute default float math:quaternion_to_axis_angle/output/stored_axis_2
return 1
