data modify storage math:internal w_comparison.predicate.rounding_remainder_can_subtract_y.minimum set compute default math:internal/comparison/predicate/rounding/remainder/can_subtract_y/minimum
execute unless predicate math:internal/rounding/remainder/can_subtract_y run return 1
execute if predicate math:internal/rounding/remainder/equal run data modify storage math:internal x set compute default math:common/arithmetic/subtract
execute if predicate math:internal/rounding/remainder/equal run return 1
data modify storage math:internal w_comparison.predicate.rounding_remainder_y_too_large_to_double.minimum set compute default math:internal/comparison/predicate/rounding/remainder/y_too_large_to_double/minimum
execute if predicate math:internal/rounding/remainder/y_too_large_to_double run data modify storage math:internal x set compute default math:common/arithmetic/subtract
execute if predicate math:internal/rounding/remainder/y_too_large_to_double run return 1
data modify storage math:internal w_remainder_original set from storage math:internal z
data modify storage math:internal w_remainder_x set from storage math:internal x
data modify storage math:internal w_remainder_divisor set from storage math:internal y
function math:.common/normalize_binary32/0.start
data modify storage math:internal w_remainder_x_exponent set from storage math:internal w_normalize_exponent
data modify storage math:internal x set from storage math:internal y
function math:.common/normalize_binary32/0.start
data modify storage math:internal w_remainder_y_exponent set from storage math:internal w_normalize_exponent
data modify storage math:internal w_remainder_shift set compute default math:common/reduce_remainder/shift
data modify storage math:internal w_remainder_scaled_divisor set from storage math:internal y
data modify storage math:internal w_remainder_scaled_divisor set compute default math:common/reduce_remainder/scale_0
data modify storage math:internal w_remainder_scaled_divisor set compute default math:common/reduce_remainder/scale_1
data modify storage math:internal w_remainder_scaled_divisor set compute default math:common/reduce_remainder/scale_2
data modify storage math:internal x set from storage math:internal w_remainder_x
data modify storage math:internal w set from storage math:internal w_remainder_scaled_divisor
data modify storage math:internal w_comparison.predicate.rounding_remainder_w_greater_than_x.minimum set compute default math:internal/comparison/predicate/rounding/remainder/w_greater_than_x/minimum
execute if predicate math:internal/rounding/remainder/w_greater_than_x run data modify storage math:internal w_remainder_scaled_divisor set compute default math:common/reduce_remainder/half_scaled_divisor
execute if predicate math:internal/rounding/remainder/w_greater_than_x run data modify storage math:internal w_remainder_shift set compute default math:common/reduce_remainder/decrement_shift
data modify storage math:internal w_remainder_remaining_shift set from storage math:internal w_remainder_shift
data modify storage math:internal y set from storage math:internal w_remainder_scaled_divisor
function math:.common/reduce_remainder/1.descend
data modify storage math:internal y set from storage math:internal w_remainder_divisor
data modify storage math:internal z set from storage math:internal w_remainder_original
return 1
