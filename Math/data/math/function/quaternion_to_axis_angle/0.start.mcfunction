data remove storage math: error
execute unless data storage math: rotation[3] run return run function math:.common/_error/invalid_quaternion
execute if data storage math: rotation[4] run return run function math:.common/_error/invalid_quaternion
execute store success storage math:internal w_validation_rotation_numeric_0 byte 1 run data get storage math: rotation[0] 1
execute unless data storage math:internal {w_validation_rotation_numeric_0:1b} run return run function math:.common/_error/invalid_quaternion
execute store success storage math:internal w_validation_rotation_numeric_1 byte 1 run data get storage math: rotation[1] 1
execute unless data storage math:internal {w_validation_rotation_numeric_1:1b} run return run function math:.common/_error/invalid_quaternion
execute store success storage math:internal w_validation_rotation_numeric_2 byte 1 run data get storage math: rotation[2] 1
execute unless data storage math:internal {w_validation_rotation_numeric_2:1b} run return run function math:.common/_error/invalid_quaternion
execute store success storage math:internal w_validation_rotation_numeric_3 byte 1 run data get storage math: rotation[3] 1
execute unless data storage math:internal {w_validation_rotation_numeric_3:1b} run return run function math:.common/_error/invalid_quaternion
data modify storage math:internal w_quaternion_component_0 set compute default float math:quaternion_to_axis_angle/input/rotation_0
data modify storage math:internal w_validation_rotation_0 set compute default float math:.validation/finite/rotation_0
execute unless data storage math:internal {w_validation_rotation_0:0.0f} run return run function math:.common/_error/invalid_quaternion
data modify storage math:internal w_quaternion_component_1 set compute default float math:quaternion_to_axis_angle/input/rotation_1
data modify storage math:internal w_validation_rotation_1 set compute default float math:.validation/finite/rotation_1
execute unless data storage math:internal {w_validation_rotation_1:0.0f} run return run function math:.common/_error/invalid_quaternion
data modify storage math:internal w_quaternion_component_2 set compute default float math:quaternion_to_axis_angle/input/rotation_2
data modify storage math:internal w_validation_rotation_2 set compute default float math:.validation/finite/rotation_2
execute unless data storage math:internal {w_validation_rotation_2:0.0f} run return run function math:.common/_error/invalid_quaternion
data modify storage math:internal w_quaternion_component_3 set compute default float math:quaternion_to_axis_angle/input/rotation_3
data modify storage math:internal w_validation_rotation_3 set compute default float math:.validation/finite/rotation_3
execute unless data storage math:internal {w_validation_rotation_3:0.0f} run return run function math:.common/_error/invalid_quaternion
data modify storage math:internal w_quaternion_maximum set compute default float math:quaternion_to_axis_angle/normalize/maximum
data modify storage math:internal w_comparison.predicate.quaternion_to_axis_angle_maximum_zero set compute default float math:.validation/predicate/quaternion_to_axis_angle/maximum_zero/value
execute if predicate math:.validation/quaternion_to_axis_angle/maximum_zero run return run function math:.common/_error/invalid_quaternion
return run function math:quaternion_to_axis_angle/1.normalize
