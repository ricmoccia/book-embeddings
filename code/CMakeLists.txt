cmake_minimum_required(VERSION 3.15)
project(BookEmbeddingsLocal)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(OGDF_DIR "C:/Users/riccardo/Desktop/book-embeddings/ogdf")
set(OGDF_BUILD "${OGDF_DIR}/build")

add_executable(book_enum main_enum.cpp)
add_executable(book_webstyle main.cpp)

foreach(target book_enum book_webstyle)
    target_include_directories(${target} PRIVATE
        "${OGDF_DIR}/include"
        "${OGDF_BUILD}/include/ogdf-release"
    )

    target_link_directories(${target} PRIVATE
        "${OGDF_BUILD}"
    )

    target_link_libraries(${target} PRIVATE
        OGDF
        COIN
    )
endforeach()