data modify storage math:internal w_comparison.predicate.rounding_remainder_can_subtract_y.minimum set compute default math:internal/comparison/predicate/rounding/remainder/can_subtract_y/minimum
execute if predicate math:internal/rounding/remainder/can_subtract_y run data modify storage math:internal x set compute default math:common/arithmetic/subtract
execute unless predicate math:internal/rounding/remainder/shift_positive run return 1
data modify storage math:internal y set compute default math:common/rounding/half_y
data modify storage math:internal w_remainder_remaining_shift set compute default math:common/reduce_remainder/decrement_remaining_shift
return run function math:.common/reduce_remainder/1.descend
