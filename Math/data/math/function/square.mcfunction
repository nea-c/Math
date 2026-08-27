data remove storage math: error
data modify storage math:internal w_validation_a set compute default math:internal/comparison/finite/a
execute unless data storage math:internal {w_validation_a:0.0f} run return run function math:internal/invalid_number
data modify storage math:internal x set from storage math: a
data modify storage math: ans set compute default math:common/arithmetic/square
data modify storage math:internal w_validation_ans set compute default math:internal/comparison/finite/ans
execute unless data storage math:internal {w_validation_ans:0.0f} run return run function math:internal/result_out_of_range
return 1
