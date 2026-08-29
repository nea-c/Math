data modify storage math:internal w_comparison.predicate.quaternion_to_axis_angle_result_angle_finite.minimum set compute default math:internal/comparison/predicate/quaternion_to_axis_angle/result_angle_finite/minimum
data modify storage math:internal w_comparison.predicate.quaternion_to_axis_angle_result_angle_finite.maximum set compute default math:internal/comparison/predicate/quaternion_to_axis_angle/result_angle_finite/maximum
execute unless predicate math:internal/quaternion_to_axis_angle/result_angle_finite run return run function math:.common/_error/invalid_quaternion
data modify storage math:internal w_comparison.predicate.quaternion_to_axis_angle_result_axis_0_finite.minimum set compute default math:internal/comparison/predicate/quaternion_to_axis_angle/result_axis_0_finite/minimum
data modify storage math:internal w_comparison.predicate.quaternion_to_axis_angle_result_axis_0_finite.maximum set compute default math:internal/comparison/predicate/quaternion_to_axis_angle/result_axis_0_finite/maximum
execute unless predicate math:internal/quaternion_to_axis_angle/result_axis_0_finite run return run function math:.common/_error/invalid_quaternion
data modify storage math:internal w_comparison.predicate.quaternion_to_axis_angle_result_axis_1_finite.minimum set compute default math:internal/comparison/predicate/quaternion_to_axis_angle/result_axis_1_finite/minimum
data modify storage math:internal w_comparison.predicate.quaternion_to_axis_angle_result_axis_1_finite.maximum set compute default math:internal/comparison/predicate/quaternion_to_axis_angle/result_axis_1_finite/maximum
execute unless predicate math:internal/quaternion_to_axis_angle/result_axis_1_finite run return run function math:.common/_error/invalid_quaternion
data modify storage math:internal w_comparison.predicate.quaternion_to_axis_angle_result_axis_2_finite.minimum set compute default math:internal/comparison/predicate/quaternion_to_axis_angle/result_axis_2_finite/minimum
data modify storage math:internal w_comparison.predicate.quaternion_to_axis_angle_result_axis_2_finite.maximum set compute default math:internal/comparison/predicate/quaternion_to_axis_angle/result_axis_2_finite/maximum
execute unless predicate math:internal/quaternion_to_axis_angle/result_axis_2_finite run return run function math:.common/_error/invalid_quaternion
data modify storage math: ans set value {angle:0.0f,axis:[0.0f,0.0f,0.0f]}
data modify storage math: ans.angle set compute default math:quaternion_to_axis_angle/output/stored_angle
data modify storage math: ans.axis[0] set compute default math:quaternion_to_axis_angle/output/stored_axis_0
data modify storage math: ans.axis[1] set compute default math:quaternion_to_axis_angle/output/stored_axis_1
data modify storage math: ans.axis[2] set compute default math:quaternion_to_axis_angle/output/stored_axis_2
return 1
