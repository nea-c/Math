data remove storage math: error
data modify storage math:internal w_validation_a set compute default float math:internal/comparison/finite/a
execute unless data storage math:internal {w_validation_a:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal w_validation_b set compute default float math:internal/comparison/finite/b
execute unless data storage math:internal {w_validation_b:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal x set from storage math: b
execute if data storage math:internal {x:0.0f} run data remove storage math: ans
execute if data storage math:internal {x:0.0f} run data modify storage math: error set value "division_by_zero"
execute if data storage math:internal {x:0.0f} run return fail
data modify storage math:internal x set from storage math: a
data modify storage math:internal y set from storage math: b
data modify storage math: ans set compute default float math:.common/arithmetic/divide
data modify storage math:internal w_validation_ans set compute default float math:internal/comparison/finite/ans
execute unless data storage math:internal {w_validation_ans:0.0f} run return run function math:.common/_error/result_out_of_range
return 1
