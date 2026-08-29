data modify storage math:internal w_atan_input set from storage math:internal x
execute if data storage math:internal {w_atan_input:0.0f} run return 1
data modify storage math:internal w_comparison.predicate.atan_x_negative.maximum set compute default math:internal/comparison/predicate/atan/x_negative/maximum
data modify storage math:internal x set compute default math:common/comparison/absolute
data modify storage math:internal w_comparison.predicate.atan_use_reciprocal.minimum set compute default math:internal/comparison/predicate/atan/use_reciprocal/minimum
execute if predicate math:internal/atan/use_reciprocal run data modify storage math:internal y set value 1.0f
execute if predicate math:internal/atan/use_reciprocal run function math:.common/reciprocal/0.start
data modify storage math:internal w_comparison.predicate.atan_use_pi_four.minimum set compute default math:internal/comparison/predicate/atan/use_pi_four/minimum
execute if predicate math:internal/atan/use_pi_four run data modify storage math:internal w_atan_numerator set compute default math:common/atan/numerator
execute if predicate math:internal/atan/use_pi_four run data modify storage math:internal x set compute default math:common/atan/denominator
execute if predicate math:internal/atan/use_pi_four run data modify storage math:internal y set value 1.0f
execute if predicate math:internal/atan/use_pi_four run function math:.common/reciprocal/0.start
execute if predicate math:internal/atan/use_pi_four run data modify storage math:internal x set compute default math:common/atan/reduced
return run function math:.common/atan/1.evaluate
