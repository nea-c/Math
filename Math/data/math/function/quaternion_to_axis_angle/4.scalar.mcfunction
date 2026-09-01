data modify storage math:internal w_quaternion_axis_0 set value 0.0f
data modify storage math:internal w_quaternion_axis_1 set value 1.0f
data modify storage math:internal w_quaternion_axis_2 set value 0.0f
data modify storage math:internal w_quaternion_angle set value 0.0f
data modify storage math:internal w_comparison.predicate.quaternion_to_axis_angle_scalar_negative set compute default float math:internal/comparison/predicate/quaternion_to_axis_angle/scalar_negative/value
execute if predicate math:internal/quaternion_to_axis_angle/scalar_negative run data modify storage math:internal w_quaternion_angle set compute default float math:common/constant/tau
return run function math:quaternion_to_axis_angle/3.finish
