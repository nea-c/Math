function math:.common/log/1.prepare
data modify storage math:internal z set compute default float math:log/normalize/numerator/00
data modify storage math:internal x set compute default float math:log/normalize/denominator/00
data modify storage math:internal w_log_mantissa set compute default float math:internal/reciprocal/log_mantissa
data modify storage math:internal w_log_reciprocal set compute default float math:internal/reciprocal/log_initial
data modify storage math:internal w_log_reciprocal set compute default float math:internal/reciprocal/log_newton
data modify storage math:internal w_log_reciprocal set compute default float math:internal/reciprocal/log_newton
data modify storage math:internal w_log_reciprocal set compute default float math:internal/reciprocal/log_newton
data modify storage math:internal x set compute default float math:internal/reciprocal/log_denominator
data modify storage math:internal z set compute default float math:log/normalize/u/00
data modify storage math:internal x set compute default float math:log/00
return 1
