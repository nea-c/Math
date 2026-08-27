data modify storage math:comparison predicate.rounding_remainder_can_subtract_y.minimum set compute default math:internal/comparison/predicate/rounding/remainder/can_subtract_y/minimum
execute unless predicate math:internal/rounding/remainder/can_subtract_y run return 1
data modify storage math:comparison predicate.rounding_remainder_y_too_large_to_double.minimum set compute default math:internal/comparison/predicate/rounding/remainder/y_too_large_to_double/minimum
execute if predicate math:internal/rounding/remainder/y_too_large_to_double run data modify storage math:internal x set compute default math:common/arithmetic/subtract
execute if predicate math:internal/rounding/remainder/y_too_large_to_double run return 1
data modify storage math:internal w set compute default math:common/rounding/double_y
data modify storage math:comparison predicate.rounding_remainder_w_greater_than_x.minimum set compute default math:internal/comparison/predicate/rounding/remainder/w_greater_than_x/minimum
execute if predicate math:internal/rounding/remainder/w_greater_than_x run data modify storage math:internal x set compute default math:common/arithmetic/subtract
execute if predicate math:internal/rounding/remainder/w_greater_than_x run return 1
data modify storage math:internal y set from storage math:internal w
function math:internal/reduce_remainder
data modify storage math:internal y set compute default math:common/rounding/half_y
data modify storage math:comparison predicate.rounding_remainder_can_subtract_y.minimum set compute default math:internal/comparison/predicate/rounding/remainder/can_subtract_y/minimum
execute if predicate math:internal/rounding/remainder/can_subtract_y run data modify storage math:internal x set compute default math:common/arithmetic/subtract
return 1
