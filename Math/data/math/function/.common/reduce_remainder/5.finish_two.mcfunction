data modify storage math:internal y set compute default math:common/rounding/half_y
data modify storage math:internal w_comparison.predicate.rounding_remainder_can_subtract_y.minimum set compute default math:internal/comparison/predicate/rounding/remainder/can_subtract_y/minimum
execute if predicate math:internal/rounding/remainder/can_subtract_y run data modify storage math:internal x set compute default math:common/arithmetic/subtract
data modify storage math:internal y set compute default math:common/rounding/half_y
data modify storage math:internal w_comparison.predicate.rounding_remainder_can_subtract_y.minimum set compute default math:internal/comparison/predicate/rounding/remainder/can_subtract_y/minimum
execute if predicate math:internal/rounding/remainder/can_subtract_y run data modify storage math:internal x set compute default math:common/arithmetic/subtract
return 1
