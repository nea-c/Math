data modify storage math: internal.x set from storage math: internal.w_quaternion_maximum
function math:.common/normalize_binary32/0.start
data modify storage math: internal.w_quaternion_scale_multiplier_a set from storage math: internal.w_normalize_multiplier_a
data modify storage math: internal.w_quaternion_scale_multiplier_b set from storage math: internal.w_normalize_multiplier_b
data modify storage math: internal.w_quaternion_maximum_mantissa set from storage math: internal.w_normalize_mantissa
data modify storage math: internal.w_quaternion_scaled_raw_0 set compute default float math:quaternion_to_axis_angle/normalize/scaled_raw_0
data modify storage math: internal.w_quaternion_scaled_raw_1 set compute default float math:quaternion_to_axis_angle/normalize/scaled_raw_1
data modify storage math: internal.w_quaternion_scaled_raw_2 set compute default float math:quaternion_to_axis_angle/normalize/scaled_raw_2
data modify storage math: internal.w_quaternion_scaled_raw_3 set compute default float math:quaternion_to_axis_angle/normalize/scaled_raw_3
data modify storage math: internal.x set from storage math: internal.w_quaternion_maximum_mantissa
data modify storage math: internal.y set value 1.0f
function math:.common/reciprocal/0.start
data modify storage math: internal.w_quaternion_inverse_maximum_mantissa set from storage math: internal.x
data modify storage math: internal.w_comparison.predicate.quaternion_to_axis_angle_scaled_0_positive_maximum set compute default float math:.validation/predicate/quaternion_to_axis_angle/scaled_0_positive_maximum/value
data modify storage math: internal.w_comparison.predicate.quaternion_to_axis_angle_scaled_0_negative_maximum set compute default float math:.validation/predicate/quaternion_to_axis_angle/scaled_0_negative_maximum/value
data modify storage math: internal.w_quaternion_scaled_0 set compute default float math:quaternion_to_axis_angle/normalize/scaled_0
execute if predicate math:.validation/quaternion_to_axis_angle/scaled_0_positive_maximum run data modify storage math: internal.w_quaternion_scaled_0 set value 1.0f
execute if predicate math:.validation/quaternion_to_axis_angle/scaled_0_negative_maximum run data modify storage math: internal.w_quaternion_scaled_0 set value -1.0f
data modify storage math: internal.w_comparison.predicate.quaternion_to_axis_angle_scaled_1_positive_maximum set compute default float math:.validation/predicate/quaternion_to_axis_angle/scaled_1_positive_maximum/value
data modify storage math: internal.w_comparison.predicate.quaternion_to_axis_angle_scaled_1_negative_maximum set compute default float math:.validation/predicate/quaternion_to_axis_angle/scaled_1_negative_maximum/value
data modify storage math: internal.w_quaternion_scaled_1 set compute default float math:quaternion_to_axis_angle/normalize/scaled_1
execute if predicate math:.validation/quaternion_to_axis_angle/scaled_1_positive_maximum run data modify storage math: internal.w_quaternion_scaled_1 set value 1.0f
execute if predicate math:.validation/quaternion_to_axis_angle/scaled_1_negative_maximum run data modify storage math: internal.w_quaternion_scaled_1 set value -1.0f
data modify storage math: internal.w_comparison.predicate.quaternion_to_axis_angle_scaled_2_positive_maximum set compute default float math:.validation/predicate/quaternion_to_axis_angle/scaled_2_positive_maximum/value
data modify storage math: internal.w_comparison.predicate.quaternion_to_axis_angle_scaled_2_negative_maximum set compute default float math:.validation/predicate/quaternion_to_axis_angle/scaled_2_negative_maximum/value
data modify storage math: internal.w_quaternion_scaled_2 set compute default float math:quaternion_to_axis_angle/normalize/scaled_2
execute if predicate math:.validation/quaternion_to_axis_angle/scaled_2_positive_maximum run data modify storage math: internal.w_quaternion_scaled_2 set value 1.0f
execute if predicate math:.validation/quaternion_to_axis_angle/scaled_2_negative_maximum run data modify storage math: internal.w_quaternion_scaled_2 set value -1.0f
data modify storage math: internal.w_comparison.predicate.quaternion_to_axis_angle_scaled_3_positive_maximum set compute default float math:.validation/predicate/quaternion_to_axis_angle/scaled_3_positive_maximum/value
data modify storage math: internal.w_comparison.predicate.quaternion_to_axis_angle_scaled_3_negative_maximum set compute default float math:.validation/predicate/quaternion_to_axis_angle/scaled_3_negative_maximum/value
data modify storage math: internal.w_quaternion_scaled_3 set compute default float math:quaternion_to_axis_angle/normalize/scaled_3
execute if predicate math:.validation/quaternion_to_axis_angle/scaled_3_positive_maximum run data modify storage math: internal.w_quaternion_scaled_3 set value 1.0f
execute if predicate math:.validation/quaternion_to_axis_angle/scaled_3_negative_maximum run data modify storage math: internal.w_quaternion_scaled_3 set value -1.0f
data modify storage math: internal.w_quaternion_scaled_square_sum set compute default float math:quaternion_to_axis_angle/normalize/scaled_square_sum
data modify storage math: internal.x set compute default float math:quaternion_to_axis_angle/normalize/scaled_square_sum
data modify storage math: internal.w_quaternion_length set compute default float math:sqrt/00
data modify storage math: internal.x set from storage math: internal.w_quaternion_length
data modify storage math: internal.y set value 1.0f
function math:.common/reciprocal/0.start
data modify storage math: internal.w_quaternion_inverse_length set from storage math: internal.x
data modify storage math: internal.w_quaternion_normalized_0 set compute default float math:quaternion_to_axis_angle/normalize/normalized_0
data modify storage math: internal.w_quaternion_normalized_1 set compute default float math:quaternion_to_axis_angle/normalize/normalized_1
data modify storage math: internal.w_quaternion_normalized_2 set compute default float math:quaternion_to_axis_angle/normalize/normalized_2
data modify storage math: internal.w_quaternion_normalized_3 set compute default float math:quaternion_to_axis_angle/normalize/normalized_3
return run function math:quaternion_to_axis_angle/3.vector
